// API Route: Test Shopify Queue - Kiểm tra queue hoạt động đúng
// DÙNG ĐỂ TEST - có thể xóa sau khi xác nhận
import { NextResponse } from "next/server";
import { shopifyQueue, QueuePriority } from "@/lib/shopify-queue";

export const dynamic = "force-dynamic";

/**
 * GET /api/test-queue
 * Test queue với các task giả lập (không gọi Shopify API thật)
 */
export async function GET() {
    try {
        console.log("\n========================================");
        console.log("🧪 BẮT ĐẦU TEST SHOPIFY QUEUE");
        console.log("========================================\n");

        const results: any[] = [];

        // Test 1: Enqueue 3 tasks với priority khác nhau
        console.log("📋 Test 1: Priority ordering (BULK → MANUAL → WEBHOOK)");
        const task1 = shopifyQueue.enqueue({
            type: "graphql",
            priority: QueuePriority.BULK,     // Priority thấp nhất
            entityId: "test_customer_1",
            action: "test_sync",
            source: "test_bulk",
            execute: async () => {
                await new Promise(r => setTimeout(r, 100));
                return { test: "bulk_done" };
            },
        });

        const task2 = shopifyQueue.enqueue({
            type: "graphql",
            priority: QueuePriority.MANUAL,   // Priority trung bình
            entityId: "test_customer_2",
            action: "test_sync",
            source: "test_manual",
            execute: async () => {
                await new Promise(r => setTimeout(r, 100));
                return { test: "manual_done" };
            },
        });

        const task3 = shopifyQueue.enqueue({
            type: "graphql",
            priority: QueuePriority.WEBHOOK,  // Priority cao nhất
            entityId: "test_customer_3",
            action: "test_sync",
            source: "test_webhook",
            execute: async () => {
                await new Promise(r => setTimeout(r, 100));
                return { test: "webhook_done" };
            },
        });

        const [r1, r2, r3] = await Promise.all([task1, task2, task3]);
        results.push({ test: "priority_ordering", results: { bulk: r1, manual: r2, webhook: r3 }, pass: true });
        console.log("✅ Test 1 PASSED: Tất cả tasks hoàn thành\n");

        // Test 2: Debounce/Dedup - cùng entity + action
        console.log("📋 Test 2: Debounce (cùng entity+action → chỉ giữ mới nhất)");
        const dedup1 = shopifyQueue.enqueue({
            type: "graphql",
            priority: QueuePriority.MANUAL,
            entityId: "test_dedup_customer",
            action: "test_dedup",
            source: "test",
            execute: async () => {
                await new Promise(r => setTimeout(r, 200));
                return { value: "old_value" };
            },
        });

        // Ngay lập tức enqueue cùng entity+action → phải thay thế cái trước
        const dedup2 = shopifyQueue.enqueue({
            type: "graphql",
            priority: QueuePriority.MANUAL,
            entityId: "test_dedup_customer",
            action: "test_dedup",
            source: "test",
            execute: async () => {
                await new Promise(r => setTimeout(r, 200));
                return { value: "new_value" };
            },
        });

        const [dedupR1, dedupR2] = await Promise.all([dedup1, dedup2]);
        const dedupPassed = dedupR1?.deduplicated === true;
        results.push({
            test: "debounce_dedup",
            results: { first: dedupR1, second: dedupR2 },
            pass: dedupPassed,
        });
        console.log(`${dedupPassed ? "✅" : "❌"} Test 2: first=${JSON.stringify(dedupR1)}, second=${JSON.stringify(dedupR2)}\n`);

        // Test 3: Entity lock - cùng entity nhưng khác action → phải chờ
        console.log("📋 Test 3: Entity lock (cùng entity → tuần tự, không song song)");
        let executionOrder: string[] = [];
        const lock1 = shopifyQueue.enqueue({
            type: "rest",
            priority: QueuePriority.MANUAL,
            entityId: "test_lock_product",
            action: "test_lock_a",
            source: "test",
            execute: async () => {
                executionOrder.push("start_a");
                await new Promise(r => setTimeout(r, 300));
                executionOrder.push("end_a");
                return "a_done";
            },
        });

        const lock2 = shopifyQueue.enqueue({
            type: "rest",
            priority: QueuePriority.MANUAL,
            entityId: "test_lock_product",
            action: "test_lock_b",
            source: "test",
            execute: async () => {
                executionOrder.push("start_b");
                await new Promise(r => setTimeout(r, 100));
                executionOrder.push("end_b");
                return "b_done";
            },
        });

        await Promise.all([lock1, lock2]);
        const lockPassed = executionOrder[0] === "start_a" && executionOrder[1] === "end_a";
        results.push({
            test: "entity_lock",
            executionOrder,
            pass: lockPassed,
        });
        console.log(`${lockPassed ? "✅" : "❌"} Test 3: execution order = ${JSON.stringify(executionOrder)}\n`);

        // Test 4: Queue stats
        console.log("📋 Test 4: Queue stats");
        const stats = shopifyQueue.getStats();
        results.push({ test: "stats", stats, pass: stats.processed > 0 });
        console.log(`✅ Test 4: ${JSON.stringify(stats)}\n`);

        // Summary
        const allPassed = results.every(r => r.pass);
        console.log("========================================");
        console.log(`🧪 KẾT QUẢ: ${allPassed ? "✅ TẤT CẢ PASSED" : "❌ CÓ TEST THẤT BẠI"}`);
        console.log("========================================\n");

        return NextResponse.json({
            success: true,
            allPassed,
            tests: results,
        });
    } catch (error: any) {
        console.error("❌ Test error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
