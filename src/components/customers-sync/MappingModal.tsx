"use client";

import { useState } from "react";
import { NhanhCustomer } from "@/types/nhanh";
import { ShopifyCustomer } from "@/types/shopify";
import { CustomerMappingData } from "@/types/mapping";
import { shopifyClient, syncClient } from "@/lib/api-client";
import { Modal } from "../ui/modal";

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: NhanhCustomer;
  existingMapping?: CustomerMappingData;
  onMappingComplete: () => void;
}

export default function MappingModal({
  isOpen,
  onClose,
  customer,
  existingMapping,
  onMappingComplete,
}: MappingModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ShopifyCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ShopifyCustomer | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      alert("Please enter email or phone to search");
      return;
    }

    try {
      setSearching(true);
      setSearchResults([]);
      
      // Use local search to find in phone, defaultAddressPhone, note, and email
      const results = await shopifyClient.searchLocal(searchQuery, 20);
      
      setSearchResults(results);
      
      if (results.length === 0) {
        alert("No customers found");
      } else if (results.length > 1) {
        console.log(`Found ${results.length} customers matching "${searchQuery}"`);
      }
    } catch (error: any) {
      console.error("Error searching:", error);
      alert("Failed to search: " + error.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleSaveMapping() {
    if (!selectedCustomer) {
      alert("Please select a Shopify customer");
      return;
    }

    try {
      setSaving(true);

      if (existingMapping) {
        // Update existing mapping
        await syncClient.updateMapping(existingMapping.id, {
          shopifyCustomerId: selectedCustomer.id,
          shopifyCustomerEmail: selectedCustomer.email,
          shopifyCustomerName: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(),
        });
      } else {
        // Create new mapping
        await syncClient.createMapping({
          nhanhCustomerId: customer.id,
          nhanhCustomerName: customer.name,
          nhanhCustomerPhone: customer.phone,
          nhanhCustomerEmail: customer.email,
          nhanhTotalSpent: customer.totalSpent,
          shopifyCustomerId: selectedCustomer.id,
          shopifyCustomerEmail: selectedCustomer.email,
          shopifyCustomerName: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim(),
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
    setSelectedCustomer(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-2xl p-6">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Map Customer to Shopify
        </h2>
        {/* Nhanh Customer Info */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Nhanh.vn Customer
          </h4>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-gray-800 dark:text-white/90">{customer.name}</p>
            {customer.phone && (
              <p className="text-gray-600 dark:text-gray-400">Phone: {customer.phone}</p>
            )}
            {customer.email && (
              <p className="text-gray-600 dark:text-gray-400">Email: {customer.email}</p>
            )}
            <p className="text-gray-600 dark:text-gray-400">
              Total Spent: {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(customer.totalSpent)}
            </p>
          </div>
        </div>

        {/* Search Section */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search Shopify Customer
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter email or phone..."
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
            Search by email or phone number
          </p>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Search Results ({searchResults.length})
            </h4>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => setSelectedCustomer(result)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedCustomer?.id === result.id
                      ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {result.firstName} {result.lastName}
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {result.email}
                      </p>
                      {result.phone && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {result.phone}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                        Orders: {result.ordersCount} • Spent: ${result.totalSpent}
                      </p>
                    </div>
                    {selectedCustomer?.id === result.id && (
                      <svg
                        className="h-5 w-5 text-brand-500"
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
            disabled={!selectedCustomer || saving}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : existingMapping ? "Update Mapping" : "Save Mapping"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
