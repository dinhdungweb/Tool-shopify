import { prisma } from "@/lib/prisma";
import {
  shopifySaleAPI,
  VariantPriceUpdate,
  VariantPriceUpdateResult,
} from "@/lib/shopify-sale-api";
import {
  DiscountType,
  PreviewProduct,
  PreviewVariant,
  ShopifyProduct,
  TargetType,
} from "@/types/sale";

type CampaignStatus = "DRAFT" | "SCHEDULED" | "APPLYING" | "ACTIVE" | "REVERTING" | "COMPLETED" | "CANCELLED" | "FAILED";

function moneyEquals(left: number | null, right: number | null) {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) < 0.005;
}

function nullableMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SaleService {
  async getAffectedProducts(
    targetType: TargetType,
    targetIds: string[],
    productType?: string,
    storeId = "default_store"
  ): Promise<ShopifyProduct[]> {
    switch (targetType) {
      case "PRODUCT":
        return targetIds.length > 0
          ? shopifySaleAPI.getProductsByIds(targetIds, storeId)
          : [];
      case "COLLECTION":
        return targetIds.length > 0
          ? shopifySaleAPI.getProductsByCollection(targetIds[0], storeId)
          : [];
      case "PRODUCT_TYPE":
        return productType
          ? shopifySaleAPI.getProductsByType(productType, storeId)
          : [];
      case "ALL":
        return shopifySaleAPI.getAllProducts(undefined, storeId);
      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }
  }

  calculateSalePrice(
    originalPrice: number,
    discountType: DiscountType,
    discountValue: number
  ): number {
    const salePrice = discountType === "PERCENTAGE"
      ? originalPrice * (1 - discountValue / 100)
      : originalPrice - discountValue;
    return Math.max(0, Math.round(salePrice * 100) / 100);
  }

  private ensureStore(campaignStoreId: string, expectedStoreId?: string) {
    if (expectedStoreId && campaignStoreId !== expectedStoreId) {
      throw new Error("Campaign does not belong to the active store");
    }
  }

  async previewCampaign(campaignId: string, expectedStoreId?: string): Promise<{
    totalProducts: number;
    totalVariants: number;
    estimatedSavings: number;
    products: PreviewProduct[];
  }> {
    const campaign = await prisma.saleCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error("Campaign not found");
    this.ensureStore(campaign.storeId, expectedStoreId);

    const products = await this.getAffectedProducts(
      campaign.targetType as TargetType,
      campaign.targetIds,
      campaign.productType || undefined,
      campaign.storeId
    );

    let totalVariants = 0;
    let estimatedSavings = 0;
    const previewProducts: PreviewProduct[] = products.map((product) => {
      const variants: PreviewVariant[] = product.variants.map((variant) => {
        const currentPrice = Number(variant.price);
        const currentCompareAtPrice = nullableMoney(variant.compareAtPrice);
        // Deliberately preserve the existing business rule: discount from compare-at price.
        const basePrice = currentCompareAtPrice || currentPrice;
        const salePrice = this.calculateSalePrice(
          basePrice,
          campaign.discountType as DiscountType,
          Number(campaign.discountValue)
        );
        const savings = basePrice - salePrice;
        totalVariants++;
        estimatedSavings += savings;
        return {
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          originalPrice: basePrice,
          salePrice,
          savings,
          savingsPercentage: basePrice > 0
            ? Math.round((savings / basePrice) * 10_000) / 100
            : 0,
        };
      });
      return { id: product.id, title: product.title, variants };
    });

    return {
      totalProducts: products.length,
      totalVariants,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      products: previewProducts,
    };
  }

  private async saveApplyProgress(campaignId: string, batch: VariantPriceUpdateResult) {
    if (batch.successfulVariantIds.length > 0) {
      await prisma.priceChange.updateMany({
        where: { campaignId, variantId: { in: batch.successfulVariantIds } },
        data: { applied: true, appliedAt: new Date(), error: null },
      });
    }
    for (const error of batch.errors) {
      await prisma.priceChange.updateMany({
        where: { campaignId, variantId: error.variantId },
        data: { error: error.error },
      });
    }
  }

  private async saveRevertProgress(campaignId: string, batch: VariantPriceUpdateResult) {
    if (batch.successfulVariantIds.length > 0) {
      await prisma.priceChange.updateMany({
        where: { campaignId, variantId: { in: batch.successfulVariantIds } },
        data: { reverted: true, revertedAt: new Date(), error: null },
      });
    }
    for (const error of batch.errors) {
      await prisma.priceChange.updateMany({
        where: { campaignId, variantId: error.variantId },
        data: { error: `Revert failed: ${error.error}` },
      });
    }
  }

  async applyCampaign(campaignId: string, expectedStoreId?: string): Promise<{
    success: boolean;
    affectedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const campaign = await prisma.saleCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error("Campaign not found");
    this.ensureStore(campaign.storeId, expectedStoreId);

    if (!(["DRAFT", "SCHEDULED"] as CampaignStatus[]).includes(campaign.status as CampaignStatus)) {
      throw new Error(`Campaign cannot be applied from status ${campaign.status}`);
    }

    const claimed = await prisma.saleCampaign.updateMany({
      where: { id: campaign.id, status: campaign.status },
      data: { status: "APPLYING", errorMessage: null },
    });
    if (claimed.count !== 1) throw new Error("Campaign is already being processed");

    try {
      const products = await this.getAffectedProducts(
        campaign.targetType as TargetType,
        campaign.targetIds,
        campaign.productType || undefined,
        campaign.storeId
      );
      const updates: VariantPriceUpdate[] = [];
      const changes: Array<{
        campaignId: string;
        productId: string;
        variantId: string;
        productTitle: string;
        variantTitle: string;
        sku?: string;
        originalPrice: number;
        originalCompareAtPrice?: number | null;
        salePrice: number;
        currentPrice: number;
      }> = [];

      for (const product of products) {
        for (const variant of product.variants) {
          const currentPrice = Number(variant.price);
          const currentCompareAtPrice = nullableMoney(variant.compareAtPrice);
          const basePrice = currentCompareAtPrice || currentPrice;
          const salePrice = this.calculateSalePrice(
            basePrice,
            campaign.discountType as DiscountType,
            Number(campaign.discountValue)
          );
          if (moneyEquals(salePrice, currentPrice)) continue;

          updates.push({
            productId: product.id,
            variantId: variant.id,
            price: salePrice,
            compareAtPrice: basePrice,
          });
          changes.push({
            campaignId: campaign.id,
            productId: product.id,
            variantId: variant.id,
            productTitle: product.title,
            variantTitle: variant.title,
            sku: variant.sku,
            originalPrice: basePrice,
            originalCompareAtPrice: currentCompareAtPrice,
            salePrice,
            currentPrice,
          });
        }
      }

      if (updates.length === 0) {
        await prisma.saleCampaign.update({
          where: { id: campaign.id },
          data: { status: "FAILED", errorMessage: "No variant prices needed updating" },
        });
        return { success: false, affectedCount: 0, failedCount: 0, errors: [] };
      }

      await prisma.$transaction(async (tx) => {
        // Serialize campaign preparation per store so two workers cannot claim overlapping variants.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${campaign.storeId}))`;
        const variantIds = updates.map((update) => update.variantId);
        const conflicts = await tx.saleCampaign.findMany({
          where: {
            storeId: campaign.storeId,
            id: { not: campaign.id },
            OR: [
              {
                status: "ACTIVE",
                priceChanges: { some: { variantId: { in: variantIds }, applied: true, reverted: false } },
              },
              {
                status: "APPLYING",
                priceChanges: { some: { variantId: { in: variantIds } } },
              },
              {
                status: "REVERTING",
                priceChanges: { some: { variantId: { in: variantIds }, applied: true, reverted: false } },
              },
            ],
          },
          select: { id: true, name: true },
        });
        if (conflicts.length > 0) {
          throw new Error(`Products overlap with campaign(s): ${conflicts.map((item) => item.name).join(", ")}`);
        }
        await tx.priceChange.createMany({ data: changes, skipDuplicates: true });
      });

      const result = await shopifySaleAPI.bulkUpdateVariantPrices(
        updates,
        campaign.storeId,
        (batch) => this.saveApplyProgress(campaign.id, batch)
      );
      await prisma.saleCampaign.update({
        where: { id: campaign.id },
        data: {
          status: result.successful > 0 ? "ACTIVE" : "FAILED",
          appliedAt: result.successful > 0 ? new Date() : null,
          affectedCount: result.successful,
          errorMessage: result.failed > 0 ? `${result.failed} variants failed to update` : null,
        },
      });
      return {
        success: result.successful > 0,
        affectedCount: result.successful,
        failedCount: result.failed,
        errors: result.errors.map((error) => `${error.variantId}: ${error.error}`),
      };
    } catch (error: any) {
      const applied = await prisma.priceChange.count({
        where: { campaignId: campaign.id, applied: true, reverted: false },
      });
      await prisma.saleCampaign.updateMany({
        where: { id: campaign.id, status: "APPLYING" },
        data: {
          status: applied > 0 ? "ACTIVE" : "FAILED",
          affectedCount: applied,
          errorMessage: error.message || "Campaign apply failed",
        },
      });
      throw error;
    }
  }

  private async getCurrentVariantMap(productIds: string[], storeId: string) {
    const products = await shopifySaleAPI.getProductsByIds(productIds, storeId);
    const variants = new Map<string, { price: number; compareAtPrice: number | null }>();
    for (const product of products) {
      for (const variant of product.variants) {
        variants.set(variant.id, {
          price: Number(variant.price),
          compareAtPrice: nullableMoney(variant.compareAtPrice),
        });
      }
    }
    return variants;
  }

  async revertCampaign(campaignId: string, expectedStoreId?: string): Promise<{
    success: boolean;
    revertedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const campaign = await prisma.saleCampaign.findUnique({
      where: { id: campaignId },
      include: { priceChanges: { where: { applied: true, reverted: false } } },
    });
    if (!campaign) throw new Error("Campaign not found");
    this.ensureStore(campaign.storeId, expectedStoreId);
    if (campaign.status !== "ACTIVE") throw new Error("Campaign is not active");
    if (campaign.priceChanges.length === 0) throw new Error("No price changes to revert");

    const claimed = await prisma.saleCampaign.updateMany({
      where: { id: campaign.id, status: "ACTIVE" },
      data: { status: "REVERTING", errorMessage: null },
    });
    if (claimed.count !== 1) throw new Error("Campaign is already being processed");

    try {
      const currentVariants = await this.getCurrentVariantMap(
        [...new Set(campaign.priceChanges.map((change) => change.productId))],
        campaign.storeId
      );
      const updates: VariantPriceUpdate[] = [];
      const errors: Array<{ variantId: string; error: string }> = [];
      let alreadyRestored = 0;

      for (const change of campaign.priceChanges) {
        const current = currentVariants.get(change.variantId);
        if (!current) {
          errors.push({ variantId: change.variantId, error: "Variant no longer exists on Shopify" });
          continue;
        }
        const restoredPrice = Number(change.currentPrice);
        const restoredCompare = nullableMoney(change.originalCompareAtPrice?.toString());
        if (moneyEquals(current.price, restoredPrice) && moneyEquals(current.compareAtPrice, restoredCompare)) {
          await prisma.priceChange.update({
            where: { id: change.id },
            data: { reverted: true, revertedAt: new Date(), error: null },
          });
          alreadyRestored++;
          continue;
        }

        const expectedSalePrice = Number(change.salePrice);
        const expectedSaleCompare = Number(change.originalPrice);
        if (!moneyEquals(current.price, expectedSalePrice) || !moneyEquals(current.compareAtPrice, expectedSaleCompare)) {
          errors.push({
            variantId: change.variantId,
            error: "Shopify price was changed outside this campaign; automatic restore was skipped",
          });
          continue;
        }

        updates.push({
          productId: change.productId,
          variantId: change.variantId,
          price: restoredPrice,
          compareAtPrice: restoredCompare,
        });
      }

      for (const error of errors) {
        await prisma.priceChange.updateMany({
          where: { campaignId: campaign.id, variantId: error.variantId },
          data: { error: `Revert failed: ${error.error}` },
        });
      }

      const result = await shopifySaleAPI.bulkUpdateVariantPrices(
        updates,
        campaign.storeId,
        (batch) => this.saveRevertProgress(campaign.id, batch)
      );
      const allErrors = [...errors, ...result.errors];
      const remaining = await prisma.priceChange.count({
        where: { campaignId: campaign.id, applied: true, reverted: false },
      });
      await prisma.saleCampaign.update({
        where: { id: campaign.id },
        data: {
          status: remaining === 0 ? "COMPLETED" : "ACTIVE",
          revertedAt: remaining === 0 ? new Date() : null,
          errorMessage: remaining > 0 ? `${remaining} variants still need to be restored` : null,
        },
      });

      const revertedCount = alreadyRestored + result.successful;
      return {
        success: revertedCount > 0,
        revertedCount,
        failedCount: allErrors.length,
        errors: allErrors.map((error) => `${error.variantId}: ${error.error}`),
      };
    } catch (error: any) {
      await prisma.saleCampaign.updateMany({
        where: { id: campaign.id, status: "REVERTING" },
        data: { status: "ACTIVE", errorMessage: error.message || "Campaign revert failed" },
      });
      throw error;
    }
  }

  async checkConflicts(
    targetType: TargetType,
    targetIds: string[],
    productType?: string,
    excludeCampaignId?: string,
    storeId = "default_store"
  ): Promise<{ hasConflict: boolean; conflictingCampaigns: any[] }> {
    const products = await this.getAffectedProducts(targetType, targetIds, productType, storeId);
    const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));
    if (variantIds.length === 0) return { hasConflict: false, conflictingCampaigns: [] };

    const conflicts = await prisma.saleCampaign.findMany({
      where: {
        storeId,
        id: excludeCampaignId ? { not: excludeCampaignId } : undefined,
        status: { in: ["ACTIVE", "APPLYING", "REVERTING"] },
        priceChanges: {
          some: { variantId: { in: variantIds }, applied: true, reverted: false },
        },
      },
      select: { id: true, name: true, status: true },
    });
    return { hasConflict: conflicts.length > 0, conflictingCampaigns: conflicts };
  }

  async recoverCampaign(campaignId: string) {
    const campaign = await prisma.saleCampaign.findUnique({
      where: { id: campaignId },
      include: { priceChanges: true },
    });
    if (!campaign || !["APPLYING", "REVERTING"].includes(campaign.status)) return null;

    const pending = campaign.status === "APPLYING"
      ? campaign.priceChanges.filter((change) => !change.applied)
      : campaign.priceChanges.filter((change) => change.applied && !change.reverted);
    const currentVariants = await this.getCurrentVariantMap(
      [...new Set(pending.map((change) => change.productId))],
      campaign.storeId
    );

    for (const change of pending) {
      const current = currentVariants.get(change.variantId);
      if (!current) continue;
      if (campaign.status === "APPLYING") {
        if (
          moneyEquals(current.price, Number(change.salePrice)) &&
          moneyEquals(current.compareAtPrice, Number(change.originalPrice))
        ) {
          await prisma.priceChange.update({
            where: { id: change.id },
            data: { applied: true, appliedAt: new Date(), error: null },
          });
        }
      } else if (
        moneyEquals(current.price, Number(change.currentPrice)) &&
        moneyEquals(current.compareAtPrice, nullableMoney(change.originalCompareAtPrice?.toString()))
      ) {
        await prisma.priceChange.update({
          where: { id: change.id },
          data: { reverted: true, revertedAt: new Date(), error: null },
        });
      }
    }

    const remaining = await prisma.priceChange.count({
      where: campaign.status === "APPLYING"
        ? { campaignId, applied: false }
        : { campaignId, applied: true, reverted: false },
    });
    const applied = await prisma.priceChange.count({
      where: { campaignId, applied: true, reverted: false },
    });
    const newStatus = campaign.status === "APPLYING"
      ? (applied > 0 ? "ACTIVE" : "FAILED")
      : (remaining === 0 ? "COMPLETED" : "ACTIVE");

    await prisma.saleCampaign.update({
      where: { id: campaign.id },
      data: {
        status: newStatus,
        affectedCount: campaign.status === "APPLYING" ? applied : campaign.affectedCount,
        revertedAt: newStatus === "COMPLETED" ? new Date() : campaign.revertedAt,
        errorMessage: remaining > 0
          ? `Recovered after restart; ${remaining} variants remain unfinished`
          : null,
      },
    });
    return { id: campaign.id, name: campaign.name, oldStatus: campaign.status, newStatus, remaining };
  }

  async recoverStuckCampaigns(storeId?: string) {
    const campaigns = await prisma.saleCampaign.findMany({
      where: {
        storeId,
        status: { in: ["APPLYING", "REVERTING"] },
      },
      select: { id: true },
    });
    const recovered = [];
    for (const campaign of campaigns) {
      const result = await this.recoverCampaign(campaign.id);
      if (result) recovered.push(result);
    }
    return recovered;
  }
}

export const saleService = new SaleService();
