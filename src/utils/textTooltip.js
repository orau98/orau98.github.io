// force-graph string labels are interpreted as HTML by float-tooltip.
// Return a DOM element so names from routes/data are always displayed as text.
export const createTextTooltip = (value, ownerDocument = document) => {
  const label = ownerDocument.createElement('span');
  label.textContent = String(value ?? '');
  return label;
};
