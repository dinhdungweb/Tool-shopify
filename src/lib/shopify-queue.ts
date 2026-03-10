/**
 * Shopify API Queue - Hàng đợi thông minh tập trung
 * 
 * Tất cả Shopify API calls đều đi qua queue này để:
 * - Throttle: Token bucket algorithm, tránh vượt rate limit
 * - Priority: WEBHOOK > MANUAL > BULK  
 * - Entity lock: Ngăn 2 request cùng entity đồng thời
 * - Debounce: Nếu cùng entity + action đang pending → thay thế bằng cái mới
 */

// Priority levels (số nhỏ = ưu tiên cao)
export enum QueuePriority {
    WEBHOOK = 1,   // Realtime, ưu tiên cao nhất
    MANUAL = 2,    // User bấm sync thủ công
    BULK = 3,      // Bulk sync, auto-sync
}

export interface QueueTask {
    id: string;                    // Unique task ID  
    type: "graphql" | "rest";      // Loại API (để track rate limit riêng)
    priority: QueuePriority;       // Mức ưu tiên
    entityId: string;              // ID entity (customer/product) - dùng cho lock + dedup
    action: string;                // Tên action (vd: "sync_customer_total_spent")
    execute: () => Promise<any>;   // Hàm thực thi
    resolve: (value: any) => void; // Promise resolve
    reject: (error: any) => void;  // Promise reject
    enqueuedAt: number;            // Timestamp enqueue
    source: string;                // Nguồn gốc (webhook, manual, bulk-sync, auto-sync)
}

export interface EnqueueOptions {
    type: "graphql" | "rest";
    priority: QueuePriority;
    entityId: string;
    action: string;
    source: string;
    execute: () => Promise<any>;
}

interface QueueStats {
    queued: number;
    processing: number;
    processed: number;
    rateLimitWaits: number;
    deduplicated: number;
    entityLockWaits: number;
    lastProcessedAt: number | null;
}

class ShopifyQueue {
    private queue: QueueTask[] = [];
    private processing = new Set<string>();     // entityIds đang được xử lý
    private isRunning = false;
    private drainTimer: ReturnType<typeof setInterval> | null = null;
    private taskIdCounter = 0;

    // Rate limit: Token bucket
    // Shopify REST: 2 req/s base → conservative 1.5 req/s
    // Shopify GraphQL: 50 points/s → conservative 40 points/s (1 query ≈ 1-10 points)
    private restTokens = 4;           // Start with some tokens
    private graphqlTokens = 40;
    private readonly REST_MAX_TOKENS = 4;        // Burst capacity (Shopify REST bucket = 40, but we're conservative)
    private readonly GRAPHQL_MAX_TOKENS = 40;
    private readonly REST_REFILL_RATE = 1.5;     // tokens/second (Shopify = 2/s)
    private readonly GRAPHQL_REFILL_RATE = 40;   // points/second (Shopify = 50/s)
    private lastRefillTime = Date.now();

    // Stats
    private stats: QueueStats = {
        queued: 0,
        processing: 0,
        processed: 0,
        rateLimitWaits: 0,
        deduplicated: 0,
        entityLockWaits: 0,
        lastProcessedAt: null,
    };

    constructor() {
        this.startDraining();
    }

    /**
     * Thêm task vào queue. Trả về Promise resolve khi task hoàn thành.
     */
    enqueue(options: EnqueueOptions): Promise<any> {
        return new Promise((resolve, reject) => {
            const taskId = `task_${++this.taskIdCounter}_${Date.now()}`;

            const task: QueueTask = {
                id: taskId,
                type: options.type,
                priority: options.priority,
                entityId: options.entityId,
                action: options.action,
                execute: options.execute,
                resolve,
                reject,
                enqueuedAt: Date.now(),
                source: options.source,
            };

            // Debounce/Dedup: Nếu cùng entityId + action đang pending → thay thế
            const existingIndex = this.queue.findIndex(
                (t) => t.entityId === options.entityId && t.action === options.action
            );

            if (existingIndex >= 0) {
                const existing = this.queue[existingIndex];
                // Resolve cái cũ với null (bị thay thế)
                existing.resolve({ deduplicated: true, replacedBy: taskId });
                // Thay thế bằng task mới
                this.queue[existingIndex] = task;
                this.stats.deduplicated++;
                console.log(`[Queue] ♻️ Dedup: ${options.action} for ${options.entityId} (replaced by ${taskId})`);
            } else {
                this.queue.push(task);
                this.stats.queued++;
            }

            // Sort by priority (số nhỏ = ưu tiên cao)
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.enqueuedAt - b.enqueuedAt; // FIFO within same priority
            });

            const priorityName = QueuePriority[options.priority];
            console.log(
                `[Queue] ➕ Enqueued: ${options.action} | entity: ${options.entityId} | priority: ${priorityName} | source: ${options.source} | queue size: ${this.queue.length}`
            );
        });
    }

    /**
     * Lấy stats hiện tại
     */
    getStats(): QueueStats & { queueDetails: { priority: string; count: number }[] } {
        const priorityCounts = new Map<number, number>();
        for (const task of this.queue) {
            priorityCounts.set(task.priority, (priorityCounts.get(task.priority) || 0) + 1);
        }

        return {
            ...this.stats,
            queued: this.queue.length,
            processing: this.processing.size,
            queueDetails: Array.from(priorityCounts.entries()).map(([p, c]) => ({
                priority: QueuePriority[p],
                count: c,
            })),
        };
    }

    // =====================
    // Private methods
    // =====================

    /**
     * Bắt đầu drain loop — xử lý queue mỗi 100ms
     */
    private startDraining() {
        if (this.drainTimer) return;

        this.drainTimer = setInterval(() => {
            this.drain();
        }, 100);
    }

    /**
     * Refill tokens theo thời gian đã trôi qua
     */
    private refillTokens() {
        const now = Date.now();
        const elapsed = (now - this.lastRefillTime) / 1000; // seconds
        this.lastRefillTime = now;

        this.restTokens = Math.min(
            this.REST_MAX_TOKENS,
            this.restTokens + elapsed * this.REST_REFILL_RATE
        );
        this.graphqlTokens = Math.min(
            this.GRAPHQL_MAX_TOKENS,
            this.graphqlTokens + elapsed * this.GRAPHQL_REFILL_RATE
        );
    }

    /**
     * Kiểm tra có đủ token để thực thi task không
     */
    private hasTokens(type: "graphql" | "rest"): boolean {
        if (type === "rest") return this.restTokens >= 1;
        return this.graphqlTokens >= 1;
    }

    /**
     * Tiêu thụ token
     */
    private consumeToken(type: "graphql" | "rest") {
        if (type === "rest") {
            this.restTokens -= 1;
        } else {
            this.graphqlTokens -= 1;
        }
    }

    /**
     * Main drain loop — lấy task từ queue và xử lý
     */
    private async drain() {
        if (this.isRunning) return; // Prevent re-entrance
        if (this.queue.length === 0) return;

        this.isRunning = true;

        try {
            this.refillTokens();

            // Tìm task tiếp theo có thể xử lý
            const taskIndex = this.queue.findIndex((task) => {
                // Entity lock: skip nếu entity đang được xử lý
                if (this.processing.has(task.entityId)) {
                    return false;
                }
                // Rate limit: skip nếu không đủ token
                if (!this.hasTokens(task.type)) {
                    return false;
                }
                return true;
            });

            if (taskIndex === -1) {
                // Không có task nào xử lý được ngay
                if (this.queue.length > 0) {
                    // Có task nhưng bị block bởi rate limit hoặc entity lock
                    const blockedByLock = this.queue.some((t) => this.processing.has(t.entityId));
                    const blockedByRate = this.queue.some((t) => !this.hasTokens(t.type));

                    if (blockedByRate) this.stats.rateLimitWaits++;
                    if (blockedByLock) this.stats.entityLockWaits++;
                }
                return;
            }

            // Lấy task ra khỏi queue
            const [task] = this.queue.splice(taskIndex, 1);

            // Lock entity
            this.processing.add(task.entityId);
            this.consumeToken(task.type);
            this.stats.processing = this.processing.size;

            // Execute task (fire and forget, không block drain loop)
            this.executeTask(task);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Thực thi 1 task
     */
    private async executeTask(task: QueueTask) {
        const startTime = Date.now();
        const priorityName = QueuePriority[task.priority];

        try {
            console.log(
                `[Queue] ▶️ Executing: ${task.action} | entity: ${task.entityId} | priority: ${priorityName} | waited: ${startTime - task.enqueuedAt}ms`
            );

            const result = await task.execute();

            const duration = Date.now() - startTime;
            console.log(
                `[Queue] ✅ Completed: ${task.action} | entity: ${task.entityId} | took: ${duration}ms`
            );

            this.stats.processed++;
            this.stats.lastProcessedAt = Date.now();
            task.resolve(result);
        } catch (error: any) {
            const duration = Date.now() - startTime;
            const isRateLimit = error.message?.includes("429") ||
                error.message?.includes("Throttled") ||
                error.message?.includes("Rate");

            if (isRateLimit) {
                // Rate limit hit — re-enqueue với cùng priority
                console.warn(
                    `[Queue] ⚠️ Rate limited: ${task.action} | entity: ${task.entityId} | re-enqueuing...`
                );

                // Giảm tokens để throttle mạnh hơn
                if (task.type === "rest") {
                    this.restTokens = Math.max(0, this.restTokens - 2); // Penalty
                } else {
                    this.graphqlTokens = Math.max(0, this.graphqlTokens - 10);
                }

                // Re-enqueue (giữ nguyên promise)
                this.queue.push({
                    ...task,
                    enqueuedAt: Date.now(), // Reset thời gian
                });
                this.queue.sort((a, b) => {
                    if (a.priority !== b.priority) return a.priority - b.priority;
                    return a.enqueuedAt - b.enqueuedAt;
                });

                this.stats.rateLimitWaits++;
            } else {
                console.error(
                    `[Queue] ❌ Failed: ${task.action} | entity: ${task.entityId} | took: ${duration}ms | error: ${error.message}`
                );
                task.reject(error);
            }
        } finally {
            // Unlock entity
            this.processing.delete(task.entityId);
            this.stats.processing = this.processing.size;
        }
    }

    /**
     * Dọn dẹp khi shutdown
     */
    destroy() {
        if (this.drainTimer) {
            clearInterval(this.drainTimer);
            this.drainTimer = null;
        }
        // Reject all pending tasks
        for (const task of this.queue) {
            task.reject(new Error("Queue destroyed"));
        }
        this.queue = [];
    }
}

// Singleton instance - tất cả routes dùng chung
// Trong môi trường serverless (Vercel), mỗi instance chạy trong 1 process
// nhưng các requests concurrent trong cùng process SẼ share queue này
export const shopifyQueue = new ShopifyQueue();
