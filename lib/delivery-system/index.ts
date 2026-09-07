// Customer Delivery System V1 — public surface.
//   COMPLETED SNAPSHOT → DeliveryDocumentV1 → TierComposer + ExportPolicy → PresentationModel → Web/PDF/CSV
export * from "@/lib/delivery-system/delivery-document";
export * from "@/lib/delivery-system/tier-composer";
export * from "@/lib/delivery-system/export-policy";
export * from "@/lib/delivery-system/presentation-model";
export * from "@/lib/delivery-system/channel-availability";
export { renderCsv } from "@/lib/delivery-system/renderers/csv";
export { renderPdfHtml } from "@/lib/delivery-system/renderers/pdf-html";
export { toWebPresentation, type WebPresentation, type WebSection, type WebSectionKind } from "@/lib/delivery-system/renderers/web";
export { deliveryFilename, dimensionValue } from "@/lib/delivery-system/renderers/shared";
