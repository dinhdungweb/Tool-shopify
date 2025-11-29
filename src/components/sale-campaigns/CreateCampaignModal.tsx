"use client";

import { useState, useEffect } from "react";
import { saleClient } from "@/lib/api-client";
import { DiscountType, TargetType, ScheduleType } from "@/types/sale";
import { Modal } from "@/components/ui/modal";
import InputField from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Select from "@/components/form/Select";
import Radio from "@/components/form/input/Radio";
import Checkbox from "@/components/form/input/Checkbox";
import DateTimePicker from "@/components/form/DateTimePicker";

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCampaignModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateCampaignModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 1: Campaign Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<string>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");

  // Step 2: Target Selection
  const [targetType, setTargetType] = useState<string>("ALL");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [productType, setProductType] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Step 3: Schedule
  const [scheduleType, setScheduleType] = useState<string>("IMMEDIATE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Step 4: Preview
  const [preview, setPreview] = useState<any>(null);
  const [tempCampaignId, setTempCampaignId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && step === 2) {
      loadTargetData();
    }
  }, [isOpen, step, targetType]);

  async function loadTargetData() {
    try {
      setProductsLoading(true);

      if (targetType === "PRODUCT") {
        const data = await saleClient.getProducts({ first: 250 });
        setProducts(data.products);
      } else if (targetType === "COLLECTION") {
        const data = await saleClient.getCollections();
        setCollections(data);
      } else if (targetType === "PRODUCT_TYPE") {
        const types = await saleClient.getProductTypes();
        setProductTypes(types);
      }
    } catch (error: any) {
      console.error("Error loading target data:", error);
      alert("Failed to load data: " + error.message);
    } finally {
      setProductsLoading(false);
    }
  }

  async function handleNext() {
    if (step === 1) {
      // Validate step 1
      if (!name.trim()) {
        alert("Please enter campaign name");
        return;
      }
      if (!discountValue || parseFloat(discountValue) <= 0) {
        alert("Please enter valid discount value");
        return;
      }
      if (discountType === "PERCENTAGE" && parseFloat(discountValue) > 100) {
        alert("Percentage discount cannot exceed 100%");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Validate step 2
      if (targetType === "PRODUCT" && selectedProducts.length === 0) {
        alert("Please select at least one product");
        return;
      }
      if (targetType === "COLLECTION" && !selectedCollection) {
        alert("Please select a collection");
        return;
      }
      if (targetType === "PRODUCT_TYPE" && !productType) {
        alert("Please enter product type");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Validate step 3
      if (scheduleType === "SCHEDULED" && !startDate) {
        alert("Please select start date");
        return;
      }
      // Create draft campaign and preview
      await createDraftAndPreview();
    }
  }

  async function createDraftAndPreview() {
    try {
      setLoading(true);

      // Prepare target IDs
      let targetIds: string[] = [];
      if (targetType === "PRODUCT") {
        targetIds = selectedProducts;
      } else if (targetType === "COLLECTION") {
        targetIds = [selectedCollection];
      }

      // Get collection title if target is COLLECTION
      let collectionTitle: string | undefined;
      if (targetType === "COLLECTION" && selectedCollection) {
        const collection = collections.find(c => c.id === selectedCollection);
        collectionTitle = collection?.title;
      }

      // Create draft campaign (without schedule info to prevent premature execution)
      const campaign = await saleClient.createCampaign({
        name,
        description,
        discountType: discountType as DiscountType,
        discountValue: parseFloat(discountValue),
        targetType: targetType as TargetType,
        targetIds,
        productType: targetType === "PRODUCT_TYPE" ? productType : undefined,
        collectionTitle: collectionTitle,
        // Don't set schedule info yet - only set when user confirms in step 4
        scheduleType: "IMMEDIATE", // Temporary, will be updated in step 4
        startDate: undefined,
        endDate: undefined,
      });

      setTempCampaignId(campaign.id);

      // Load preview
      setPreviewLoading(true);
      const previewData = await saleClient.previewCampaign(campaign.id);
      console.log("Preview data:", previewData);
      
      if (previewData.totalProducts === 0) {
        console.warn("No products found for campaign. Target:", {
          targetType,
          targetIds,
          productType
        });
      }
      
      setPreview(previewData);
      setStep(4);
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign: " + error.message);
    } finally {
      setLoading(false);
      setPreviewLoading(false);
    }
  }

  async function handleApply() {
    if (!tempCampaignId) return;

    try {
      setLoading(true);

      if (scheduleType === "IMMEDIATE") {
        // Apply immediately
        const result = await saleClient.applyCampaign(tempCampaignId);
        console.log("Apply result:", result);
        
        if (result.affectedCount === 0) {
          alert(`Campaign created but no products were affected.\n\nThis might be because:\n- No products match the target criteria\n- Products already have the same price\n- There was an error fetching products\n\nFailed: ${result.failedCount}\nErrors:\n${result.errors.slice(0, 5).join("\n")}`);
        } else if (result.failedCount > 0) {
          // Some succeeded, some failed
          alert(`Campaign applied with some errors!\n\n✓ Successfully updated: ${result.affectedCount} variants\n✗ Failed to update: ${result.failedCount} variants\n\nErrors:\n${result.errors.slice(0, 5).join("\n")}\n\n${result.failedCount > 5 ? `... and ${result.failedCount - 5} more errors` : ""}`);
        } else {
          // All succeeded
          alert(`Campaign applied successfully!\n\n✓ ${result.affectedCount} variants updated.`);
        }
      } else {
        // Update campaign with schedule info and set status to SCHEDULED
        await saleClient.updateCampaign(tempCampaignId, {
          status: "SCHEDULED",
          scheduleType: "SCHEDULED",
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        });
        
        const startTime = new Date(startDate).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        
        let message = `Campaign scheduled successfully!\n\n`;
        message += `📅 Start: ${startTime}\n`;
        
        if (endDate) {
          const endTime = new Date(endDate).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          message += `📅 End: ${endTime}\n`;
        }
        
        message += `\n📊 Preview:\n`;
        message += `• ${preview?.totalProducts || 0} products\n`;
        message += `• ${preview?.totalVariants || 0} variants will be updated\n`;
        message += `• Discount: ${discountType === "PERCENTAGE" ? discountValue + "%" : formatCurrency(parseFloat(discountValue))}\n`;
        message += `\nThe campaign will automatically apply at the scheduled time.`;
        
        alert(message);
      }

      // Wait a bit for database to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Clear tempCampaignId so handleClose won't delete it
      setTempCampaignId(null);
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Error applying campaign:", error);
      alert("Failed to apply campaign: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    // If a draft campaign was created but not applied/scheduled, delete it
    // Only delete if still in DRAFT status (not SCHEDULED or ACTIVE)
    if (tempCampaignId !== null && step === 4) {
      try {
        // Check campaign status before deleting
        const campaign = await saleClient.getCampaignById(tempCampaignId);
        
        if (campaign.status === "DRAFT") {
          await saleClient.deleteCampaign(tempCampaignId);
          console.log("Deleted draft campaign:", tempCampaignId);
        } else {
          console.log("Campaign already applied/scheduled, not deleting:", campaign.status);
        }
      } catch (error) {
        console.error("Error handling draft campaign:", error);
      }
    }
    
    setStep(1);
    setName("");
    setDescription("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("");
    setTargetType("ALL");
    setSelectedProducts([]);
    setSelectedCollection("");
    setProductType("");
    setScheduleType("IMMEDIATE");
    setStartDate("");
    setEndDate("");
    setPreview(null);
    setTempCampaignId(null);
    setProducts([]);
    setCollections([]);
    setProductTypes([]);
    
    onClose();
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Create Sale Campaign
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Step {step} of 4
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                s <= step ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800 dark:text-white">Campaign Information</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Campaign Name *
              </label>
              <InputField
                type="text"
                defaultValue={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Sale 2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <TextArea
                value={description}
                onChange={(value) => setDescription(value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Discount Type *
                </label>
                <Select
                  options={[
                    { value: "PERCENTAGE", label: "Percentage (%)" },
                    { value: "FIXED_AMOUNT", label: "Fixed Amount (VND)" }
                  ]}
                  defaultValue={discountType}
                  onChange={(value) => setDiscountType(value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Discount Value *
                </label>
                <InputField
                  type="number"
                  defaultValue={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 50000"}
                  min="0"
                  max={discountType === "PERCENTAGE" ? "100" : undefined}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800 dark:text-white">Select Target Products</h4>

            <div className="space-y-3">
              {[
                { value: "ALL", label: "All Products" },
                { value: "PRODUCT", label: "Specific Products" },
                { value: "COLLECTION", label: "Collection" },
                { value: "PRODUCT_TYPE", label: "Product Type" },
              ].map((option) => (
                <Radio
                  key={option.value}
                  id={`target-${option.value}`}
                  name="targetType"
                  value={option.value}
                  label={option.label}
                  checked={targetType === option.value}
                  onChange={(value) => setTargetType(value)}
                />
              ))}
            </div>

            {targetType === "PRODUCT" && (
              <div className="mt-4">
                {productsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                    {products.map((product) => (
                      <Checkbox
                        key={product.id}
                        id={`product-${product.id}`}
                        label={product.title}
                        checked={selectedProducts.includes(product.id)}
                        onChange={(checked) => {
                          if (checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {targetType === "COLLECTION" && (
              <div className="mt-4">
                {productsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
                  </div>
                ) : (
                  <Select
                    options={collections.map((collection) => ({
                      value: collection.id,
                      label: `${collection.title} (${collection.productsCount} products)`
                    }))}
                    placeholder="Select collection..."
                    defaultValue={selectedCollection}
                    onChange={(value) => setSelectedCollection(value)}
                  />
                )}
              </div>
            )}

            {targetType === "PRODUCT_TYPE" && (
              <div className="mt-4">
                {productsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
                  </div>
                ) : productTypes.length > 0 ? (
                  <Select
                    options={productTypes.map((type) => ({
                      value: type,
                      label: type
                    }))}
                    placeholder="Select product type..."
                    defaultValue={productType}
                    onChange={(value) => setProductType(value)}
                  />
                ) : (
                  <InputField
                    type="text"
                    defaultValue={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    placeholder="Enter product type"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800 dark:text-white">Schedule Campaign</h4>

            <div className="space-y-3">
              {[
                { value: "IMMEDIATE", label: "Apply Immediately" },
                { value: "SCHEDULED", label: "Schedule for Later" },
              ].map((option) => (
                <Radio
                  key={option.value}
                  id={`schedule-${option.value}`}
                  name="scheduleType"
                  value={option.value}
                  label={option.label}
                  checked={scheduleType === option.value}
                  onChange={(value) => setScheduleType(value)}
                />
              ))}
            </div>

            {scheduleType === "SCHEDULED" && (
              <div className="mt-4 space-y-4">
                <DateTimePicker
                  id="campaign-start-date"
                  label="Start Date & Time *"
                  value={startDate}
                  onChange={(date) => setStartDate(date)}
                  placeholder="Select start date and time"
                />

                <div>
                  <DateTimePicker
                    id="campaign-end-date"
                    label="End Date & Time (Optional)"
                    value={endDate}
                    onChange={(date) => setEndDate(date)}
                    placeholder="Select end date and time"
                    minDate={startDate}
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Campaign will automatically revert when end date is reached
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800 dark:text-white">Preview & Confirm</h4>

            {previewLoading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
                <p className="mt-4 text-sm text-gray-500">Loading preview...</p>
              </div>
            ) : preview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Products</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white">
                      {preview.totalProducts}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Variants</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white">
                      {preview.totalVariants}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Est. Savings</p>
                    <p className="mt-1 text-2xl font-semibold text-success-600 dark:text-success-400">
                      {formatCurrency(preview.estimatedSavings)}
                    </p>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Product</th>
                        <th className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">Original</th>
                        <th className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">Sale Price</th>
                        <th className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">Savings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {preview.products.slice(0, 20).map((product: any) =>
                        product.variants.map((variant: any) => (
                          <tr key={variant.id}>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                              {product.title}
                              {variant.title !== "Default Title" && (
                                <span className="text-gray-500"> - {variant.title}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                              {formatCurrency(variant.originalPrice)}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-success-600 dark:text-success-400">
                              {formatCurrency(variant.salePrice)}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                              -{variant.savingsPercentage}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {preview.totalVariants > 20 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Showing first 20 variants. Total: {preview.totalVariants}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
        >
          {step === 1 ? "Cancel" : "Back"}
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Next"}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleApply}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-success-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-success-600 disabled:opacity-50"
          >
            {loading ? "Applying..." : scheduleType === "IMMEDIATE" ? "Apply Now" : "Schedule Campaign"}
          </button>
        )}
      </div>
    </Modal>
  );
}
