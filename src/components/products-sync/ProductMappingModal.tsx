"use client";

import { useState } from "react";
import { NhanhProduct, ShopifyProduct } from "@/types/product";
import { productSyncClient } from "@/lib/api-client";
import { Modal } from "../ui/modal";

interface ProductMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ShopifyProduct;
  existingMapping?: any;
  onMappingComplete: () => void;
}

export default function ProductMappingModal({
  isOpen,
  onClose,
  product,
  existingMapping,
  onMappingComplete,
}: ProductMappingModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NhanhProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<NhanhProduct | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      alert("Please enter a keyword to search");
      return;
    }

    try {
      setSearching(true);
      setSearchResults([]);
      
      // Search from local database first (faster)
      const localResults = await productSyncClient.searchLocalNhanhProducts(searchQuery);
      
      setSearchResults(localResults);
      
      if (localResults.length === 0) {
        alert("No products found in local database.\n\nPlease pull Nhanh products first using 'Pull Nhanh Products' button.");
      }
    } catch (error: any) {
      console.error("Error searching:", error);
      alert("Failed to search: " + error.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleSaveMapping() {
    if (!selectedProduct) {
      alert("Please select a Nhanh product");
      return;
    }

    try {
      setSaving(true);

      if (existingMapping) {
        // Update existing mapping
        await productSyncClient.updateProductMapping(existingMapping.id, {
          nhanhProductId: selectedProduct.id,
          nhanhProductName: selectedProduct.name,
          nhanhSku: selectedProduct.sku,
          nhanhBarcode: selectedProduct.barcode,
          nhanhPrice: selectedProduct.price,
        });
      } else {
        // Create new mapping
        await productSyncClient.createProductMapping({
          shopifyProductId: product.id,
          shopifyVariantId: product.variantId,
          shopifyProductTitle: product.title,
          shopifySku: product.sku,
          shopifyBarcode: product.barcode,
          nhanhProductId: selectedProduct.id,
          nhanhProductName: selectedProduct.name,
          nhanhSku: selectedProduct.sku,
          nhanhBarcode: selectedProduct.barcode,
          nhanhPrice: selectedProduct.price,
        });
      }

      alert("Mapping saved successfully!");
      onMappingComplete();
    } catch (error: any) {
      console.error("Error saving mapping:", error);
      alert("Failed to save mapping: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedProduct(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-3xl p-6">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Map Product with Nhanh.vn
        </h2>

        {/* Shopify Product Info */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Shopify Product
          </h4>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-gray-800 dark:text-white/90">{product.title}</p>
            {product.sku && (
              <p className="text-gray-600 dark:text-gray-400">SKU: {product.sku}</p>
            )}
            {product.barcode && (
              <p className="text-gray-600 dark:text-gray-400">Barcode: {product.barcode}</p>
            )}
            <p className="text-gray-600 dark:text-gray-400">
              Inventory: <span className="font-medium text-brand-600">{product.inventoryQuantity}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Price: ${product.price}
            </p>
          </div>
        </div>

        {/* Search Section */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search Nhanh.vn Product
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter product name, SKU or barcode..."
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90 dark:placeholder:text-gray-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Search products on Nhanh.vn by name, SKU or barcode
          </p>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Search Results ({searchResults.length})
            </h4>
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => setSelectedProduct(result)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selectedProduct?.id === result.id
                      ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {result.name}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                        {result.sku && <span>SKU: {result.sku}</span>}
                        {result.barcode && <span>Barcode: {result.barcode}</span>}
                        <span>Stock: <span className="font-medium text-brand-600">{result.quantity}</span></span>
                        <span>Price: {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(result.price)}</span>
                      </div>
                      {result.categoryName && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                          Category: {result.categoryName}
                        </p>
                      )}
                    </div>
                    {selectedProduct?.id === result.id && (
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-brand-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveMapping}
            disabled={!selectedProduct || saving}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : existingMapping ? "Update Mapping" : "Save Mapping"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
