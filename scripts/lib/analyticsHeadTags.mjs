const sanitizeMeasurementId = (value) =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '');

export function buildAnalyticsHeadTags(measurementId) {
  const safeMeasurementId = sanitizeMeasurementId(measurementId);
  if (!safeMeasurementId) return '';

  return `<script src="/assets/analytics-loader.js" data-measurement-id="${safeMeasurementId}" data-send-page-view="true"></script>`;
}
