"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import Button from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/ToastContainer";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import Select from "@/components/form/Select";
import Label from "@/components/form/Label";
import { TrashBinIcon } from "@/icons";

interface LocationMapping {
    id: string;
    nhanhDepotId: string;
    nhanhDepotName: string;
    shopifyLocationId: string;
    shopifyLocationName: string;
    active: boolean;
}

interface Depot {
    id: number;
    name: string;
}

interface Location {
    id: string;
    name: string;
}

export interface LocationMappingTableRef {
    openModal: () => void;
}

const LocationMappingTable = forwardRef<LocationMappingTableRef>((_, ref) => {
    const { showToast } = useToast();
    const [mappings, setMappings] = useState<LocationMapping[]>([]);
    const [nhanhDepots, setNhanhDepots] = useState<Depot[]>([]);
    const [shopifyLocations, setShopifyLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDepot, setSelectedDepot] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("");

    // Expose openModal to parent
    useImperativeHandle(ref, () => ({
        openModal: () => {
            setSelectedDepot("");
            setSelectedLocation("");
            setIsModalOpen(true);
        }
    }));

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const response = await fetch("/api/settings/locations");
            const result = await response.json();

            if (result.success) {
                setMappings(result.data.mappings);
                setNhanhDepots(result.data.nhanhDepots);
                setShopifyLocations(result.data.shopifyLocations);

                if (result.data.errors) {
                    if (result.data.errors.shopify) showToast(`Shopify Warning: ${result.data.errors.shopify}`, "warning");
                    if (result.data.errors.nhanh) showToast(`Nhanh Warning: ${result.data.errors.nhanh}`, "warning");
                }
            } else {
                showToast(`Failed to load location data: ${result.error}`, "error");
            }
        } catch (error: any) {
            showToast(`Error: ${error.message}`, "error");
        } finally {
            setLoading(false);
        }
    }

    function closeModal() {
        setIsModalOpen(false);
        setSelectedDepot("");
        setSelectedLocation("");
    }

    async function handleAddMapping() {
        if (!selectedDepot || !selectedLocation) return;

        try {
            setSaving(true);

            const depot = nhanhDepots.find(d => d.id.toString() === selectedDepot);
            const location = shopifyLocations.find(l => l.id === selectedLocation);

            if (!depot || !location) return;

            const response = await fetch("/api/settings/locations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nhanhDepotId: depot.id,
                    nhanhDepotName: depot.name,
                    shopifyLocationId: location.id,
                    shopifyLocationName: location.name,
                    active: true,
                }),
            });

            const result = await response.json();

            if (result.success) {
                showToast("Mapping added successfully", "success");
                setMappings(prev => {
                    const existing = prev.findIndex(m => m.id === result.data.id);
                    if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = result.data;
                        return updated;
                    }
                    return [result.data, ...prev];
                });
                closeModal();
            } else {
                showToast(`Failed to add mapping: ${result.error}`, "error");
            }
        } catch (error: any) {
            showToast(`Error: ${error.message}`, "error");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this mapping?")) return;

        try {
            const response = await fetch(`/api/settings/locations?id=${id}`, {
                method: "DELETE",
            });

            const result = await response.json();

            if (result.success) {
                showToast("Mapping deleted", "success");
                setMappings(prev => prev.filter(m => m.id !== id));
            } else {
                showToast(`Failed to delete: ${result.error}`, "error");
            }
        } catch (error: any) {
            showToast(`Error: ${error.message}`, "error");
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500"></div>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading locations...</span>
            </div>
        );
    }

    return (
        <>
            {/* Mappings Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableCell isHeader>Nhanh Depot</TableCell>
                            <TableCell isHeader>Shopify Location</TableCell>
                            <TableCell isHeader>Status</TableCell>
                            <TableCell isHeader className="text-right">Actions</TableCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {mappings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8">
                                    <div className="text-gray-500 dark:text-gray-400">
                                        <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <p className="mt-2 text-sm">No mappings configured</p>
                                        <p className="mt-1 text-xs text-gray-400">Click &quot;Add Mapping&quot; to connect a depot to a location</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            mappings.map((mapping) => (
                                <TableRow key={mapping.id}>
                                    <TableCell>
                                        <div className="font-medium text-gray-900 dark:text-white">{mapping.nhanhDepotName}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ID: {mapping.nhanhDepotId}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-gray-900 dark:text-white">{mapping.shopifyLocationName}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            size="sm"
                                            color={mapping.active ? "success" : "warning"}
                                        >
                                            {mapping.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => handleDelete(mapping.id)}
                                                className="p-2 text-gray-500 hover:text-error-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                title="Delete mapping"
                                            >
                                                <TrashBinIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Add Mapping Modal */}
            <Modal isOpen={isModalOpen} onClose={closeModal} className="max-w-lg p-6 lg:p-8">
                <div className="space-y-6">
                    {/* Modal Header */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Add Location Mapping
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Connect a Nhanh depot to a Shopify location for inventory syncing
                        </p>
                    </div>

                    {/* Form */}
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">Nhanh Depot (Source)</Label>
                            <Select
                                options={nhanhDepots.map(d => ({ value: d.id.toString(), label: d.name }))}
                                value={selectedDepot}
                                onChange={setSelectedDepot}
                                placeholder="Select a depot..."
                            />
                        </div>

                        <div>
                            <Label className="mb-2">Shopify Location (Destination)</Label>
                            <Select
                                options={shopifyLocations.map(l => ({ value: l.id, label: l.name }))}
                                value={selectedLocation}
                                onChange={setSelectedLocation}
                                placeholder="Select a location..."
                            />
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4">
                        <Button variant="outline" size="sm" onClick={closeModal}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleAddMapping}
                            disabled={!selectedDepot || !selectedLocation || saving}
                            startIcon={
                                saving ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                ) : undefined
                            }
                        >
                            {saving ? "Adding..." : "Add Mapping"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
});

LocationMappingTable.displayName = "LocationMappingTable";

export default LocationMappingTable;
