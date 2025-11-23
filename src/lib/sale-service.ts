// Sale Campaign Service
import { prisma } from "@/lib/prisma";
import { shopifySaleAPI } from "@/lib/shopify-sale-api";
import {
  TargetType,
  DiscountType,
  ShopifyProduct,
  PreviewProduct,
  PreviewVariant,
} from "@/types/sale";

export class SaleService {
  /**
   * Get affected products based on campaign target
   */
  async getAffectedProducts(
    targetType: TargetType,
    targetIds: string[],
    productType?: string
  ): Promise<ShopifyProduct[]> {
    let products: ShopifyProduct[] = [];

    console.log("Getting affected products:", { targetType, targetIds, productType });

    switch (targetType) {
      case "PRODUCT":
        if (targetIds.length > 0) {
          console.log("Fetching products by IDs:", targetIds);
          products = await shopifySaleAPI.getProductsByIds(targetIds);
          console.log("Fetched products count:", products.length);
        }
        break;

      case "COLLECTION":
        if (targetIds.length > 0) {
          console.log("Fetching products by collection:", targetIds[0]);
          products = await shopifySaleAPI.getProductsByCollection(targetIds[0]);
          console.log("Fetched products count:", products.length);
        }
        break;

      case "PRODUCT_TYPE":
        if (productType) {
          console.log("Fetching products by type:", productType);
          products = await shopifySaleAPI.getProductsByType(productType);
          console.log("Fetched products count:", products.length);
        }
        break;

      case "ALL":
        console.log("Fetching all products");
        products = await shopifySaleAPI.getAllProducts();
        console.log("Fetched products count:", products.length);
        break;

      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }

    console.log("Total affected products:", products.length);
    return products;
  }

  /**
   * Calculate sale price
   */
  calculateSalePrice(
    originalPrice: number,
    discountType: DiscountType,
    discountValue: number
  ): number {
    let salePrice: number;

    if (discountType === "PERCENTAGE") {
      salePrice = originalPrice * (1 - discountValue / 100);
    } else {
      // FIXED_AMOUNT
      salePrice = originalPrice - discountValue;
    }

    // Ensure price is not negative
    return Math.max(0, Math.round(salePrice * 100) / 100);
  }

  /**
   * Preview campaign - show what will be affected
   */
  async previewCampaign(campaignId: string): Promise<{
    totalProducts: number;
    totalVariants: number;
    estimatedSavings: number;
    products: PreviewProduct[];
  }> {
    const campaign = await prisma.saleCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const products = await this.getAffectedProducts(
      campaign.targetType as TargetType,
      campaign.targetIds,
      campaign.productType || undefined
    );

    let totalVariants = 0;
    let estimatedSavings = 0;

    const previewProducts: PreviewProduct[] = products.map((product) => {
      const previewVariants: PreviewVariant[] = product.variants.map(
        (variant) => {
          const currentPrice = parseFloat(variant.price);
          const currentCompareAtPrice = variant.compareAtPrice 
            ? parseFloat(variant.compareAtPrice) 
            : null;
          
          // Use same logic as apply: compare_at_price if exists, otherwise current price
          const basePrice = currentCompareAtPrice || currentPrice;
          
          const salePrice = this.calculateSalePrice(
            basePrice,
            campaign.discountType as DiscountType,
            Number(campaign.discountValue)
          );
          const savings = basePrice - salePrice;
          const savingsPercentage =
            basePrice > 0 ? (savings / basePrice) * 100 : 0;

          totalVariants++;
          estimatedSavings += savings;

          return {
            id: variant.id,
            title: variant.title,
            sku: variant.sku,
            originalPrice: basePrice, // Show base price as original
            salePrice,
            savings,
            savingsPercentage: Math.round(savingsPercentage * 100) / 100,
          };
        }
      );

      return {
        id: product.id,
        title: product.title,
        variants: previewVariants,
      };
    });

    return {
      totalProducts: products.length,
      totalVariants,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      products: previewProducts,
    };
  }

  /**
   * Apply campaign - update prices on Shopify
   */
  async applyCampaign(campaignId: string): Promise<{
    success: boolean;
    affectedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const campaign = await prisma.saleCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Validate campaign status
    if (campaign.status === "ACTIVE") {
      throw new Error("Campaign is already active");
    }

    if (campaign.status === "COMPLETED") {
      throw new Error("Campaign is already completed");
    }

    if (campaign.status === "CANCELLED") {
      throw new Error("Campaign is cancelled");
    }

    // Get affected products
    const products = await this.getAffectedProducts(
      campaign.targetType as TargetType,
      campaign.targetIds,
      campaign.productType || undefined
    );

    console.log(`Applying campaign to ${products.length} products...`);

    const priceUpdates: Array<{
      variantId: string;
      price: number;
      compareAtPrice: number;
    }> = [];

    const priceChangeRecords: Array<{
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

    // Prepare all updates
    for (const product of products) {
      for (const variant of product.variants) {
        const currentPrice = parseFloat(variant.price);
        const currentCompareAtPrice = variant.compareAtPrice 
          ? parseFloat(variant.compareAtPrice) 
          : null;
        
        // Determine the base price for discount calculation:
        // - If compare_at_price exists, use it (it's the original price)
        // - Otherwise, use current price
        const basePrice = currentCompareAtPrice || currentPrice;
        
        // Calculate new sale price based on the base price
        const salePrice = this.calculateSalePrice(
          basePrice,
          campaign.discountType as DiscountType,
          Number(campaign.discountValue)
        );

        // Skip if sale price is same as current price
        if (salePrice === currentPrice) {
          continue;
        }

        // When applying sale:
        // - Set price to salePrice (new discounted price)
        // - Set compareAtPrice to basePrice (original price to show strikethrough)
        priceUpdates.push({
          variantId: variant.id,
          price: salePrice,
          compareAtPrice: basePrice,
        });

        priceChangeRecords.push({
          campaignId: campaign.id,
          productId: product.id,
          variantId: variant.id,
          productTitle: product.title,
          variantTitle: variant.title,
          sku: variant.sku,
          originalPrice: basePrice, // Store base price for display (this is the "original" price shown to users)
          originalCompareAtPrice: currentCompareAtPrice, // Store original compare_at_price to restore later
          salePrice,
          currentPrice, // Store current price to restore later
        });
      }
    }

    console.log(`Prepared ${priceUpdates.length} price updates`);

    // Update campaign status to APPLYING
    await prisma.saleCampaign.update({
      where: { id: campaign.id },
      data: { status: "APPLYING" },
    });

    // Create price change records first
    await prisma.priceChange.createMany({
      data: priceChangeRecords,
    });

    // Apply updates to Shopify
    const result = await shopifySaleAPI.bulkUpdateVariantPrices(priceUpdates);

    console.log(
      `Applied: ${result.successful} successful, ${result.failed} failed`
    );

    // Update price change records with results
    const successfulVariantIds = priceUpdates
      .filter(
        (update) =>
          !result.errors.find((e) => e.variantId === update.variantId)
      )
      .map((u) => u.variantId);

    if (successfulVariantIds.length > 0) {
      await prisma.priceChange.updateMany({
        where: {
          campaignId: campaign.id,
          variantId: { in: successfulVariantIds },
        },
        data: {
          applied: true,
          appliedAt: new Date(),
        },
      });
    }

    // Update failed records
    for (const error of result.errors) {
      await prisma.priceChange.updateMany({
        where: {
          campaignId: campaign.id,
          variantId: error.variantId,
        },
        data: {
          error: error.error,
        },
      });
    }

    // Update campaign status
    await prisma.saleCampaign.update({
      where: { id: campaign.id },
      data: {
        status: result.successful > 0 ? "ACTIVE" : "FAILED",
        appliedAt: new Date(),
        affectedCount: result.successful,
        errorMessage:
          result.failed > 0
            ? `${result.failed} variants failed to update`
            : null,
      },
    });

    return {
      success: result.successful > 0,
      affectedCount: result.successful,
      failedCount: result.failed,
      errors: result.errors.map((e) => `${e.variantId}: ${e.error}`),
    };
  }

  /**
   * Revert campaign - restore original prices
   */
  async revertCampaign(campaignId: string): Promise<{
    success: boolean;
    revertedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const campaign = await prisma.saleCampaign.findUnique({
      where: { id: campaignId },
      include: {
        priceChanges: {
          where: {
            applied: true,
            reverted: false,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status !== "ACTIVE") {
      throw new Error("Campaign is not active");
    }

    if (campaign.priceChanges.length === 0) {
      throw new Error("No price changes to revert");
    }

    console.log(`Reverting ${campaign.priceChanges.length} price changes...`);

    // Update campaign status to REVERTING
    await prisma.saleCampaign.update({
      where: { id: campaign.id },
      data: { status: "REVERTING" },
    });

    // When reverting:
    // - Restore price to currentPrice (the price before campaign was applied)
    // - Restore compareAtPrice to originalCompareAtPrice (or null if didn't exist)
    const priceUpdates = campaign.priceChanges.map((change) => ({
      variantId: change.variantId,
      price: Number(change.currentPrice), // Restore to price before campaign
      compareAtPrice: change.originalCompareAtPrice 
        ? Number(change.originalCompareAtPrice) 
        : null,
    }));

    // Apply updates to Shopify
    const result = await shopifySaleAPI.bulkUpdateVariantPrices(priceUpdates);

    console.log(
      `Reverted: ${result.successful} successful, ${result.failed} failed`
    );

    // Update price change records
    const successfulVariantIds = priceUpdates
      .filter(
        (update) =>
          !result.errors.find((e) => e.variantId === update.variantId)
      )
      .map((u) => u.variantId);

    if (successfulVariantIds.length > 0) {
      await prisma.priceChange.updateMany({
        where: {
          campaignId: campaign.id,
          variantId: { in: successfulVariantIds },
        },
        data: {
          reverted: true,
          revertedAt: new Date(),
        },
      });
    }

    // Update failed records
    for (const error of result.errors) {
      await prisma.priceChange.updateMany({
        where: {
          campaignId: campaign.id,
          variantId: error.variantId,
        },
        data: {
          error: `Revert failed: ${error.error}`,
        },
      });
    }

    // Update campaign status
    await prisma.saleCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "COMPLETED",
        revertedAt: new Date(),
      },
    });

    return {
      success: result.successful > 0,
      revertedCount: result.successful,
      failedCount: result.failed,
      errors: result.errors.map((e) => `${e.variantId}: ${e.error}`),
    };
  }

  /**
   * Check for conflicting campaigns
   */
  async checkConflicts(
    targetType: TargetType,
    targetIds: string[],
    productType?: string,
    excludeCampaignId?: string
  ): Promise<{ hasConflict: boolean; conflictingCampaigns: any[] }> {
    // Get active campaigns
    const activeCampaigns = await prisma.saleCampaign.findMany({
      where: {
        status: "ACTIVE",
        id: excludeCampaignId ? { not: excludeCampaignId } : undefined,
      },
    });

    const conflictingCampaigns = activeCampaigns.filter((campaign) => {
      // Check if targets overlap
      if (targetType === "ALL" || campaign.targetType === "ALL") {
        return true;
      }

      if (targetType === campaign.targetType) {
        if (targetType === "PRODUCT_TYPE") {
          return productType === campaign.productType;
        }

        if (targetType === "PRODUCT" || targetType === "COLLECTION") {
          return targetIds.some((id) => campaign.targetIds.includes(id));
        }
      }

      return false;
    });

    return {
      hasConflict: conflictingCampaigns.length > 0,
      conflictingCampaigns,
    };
  }
}

export const saleService = new SaleService();
