// Validate the complete frozen summary before either rendering or exporting it.
export function validCoverSummary(data) {
  if (data?.product !== 'ESA WorldCover 2021 v200' || !Number.isFinite(data.total_classified_km2) || data.total_classified_km2 <= 0 || !Array.isArray(data.classes) || !data.classes.length) return false;
  if (!['geography','method','not_for','attribution','citation'].every(key => typeof data[key] === 'string' && data[key].trim())) return false;
  if (data.license !== 'CC BY 4.0' || data.license_url !== 'https://creativecommons.org/licenses/by/4.0/' || data.citation_url !== 'https://doi.org/10.5281/zenodo.7254221') return false;
  if (!Array.isArray(data.source_urls) || data.source_urls.length !== 2 || !data.source_sha256 || typeof data.source_sha256 !== 'object') return false;
  for (const tile of ['N18E108','N18E111']) {
    if (!data.source_urls.includes(`https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${tile}_Map.tif`) || !/^[a-f0-9]{64}$/i.test(data.source_sha256[tile] ?? '')) return false;
  }
  if (data.mask_overview_m !== 100 || ![data.mask_area_100m_km2,data.mask_area_200m_km2].every(value => Number.isFinite(value) && value > 0) || !Number.isSafeInteger(data.masked_nodata_pixels) || data.masked_nodata_pixels < 0 || !Number.isFinite(data.mask_sampling_difference_percent) || data.mask_sampling_difference_percent < 0) return false;
  // The snapshot rounds this percent to three decimals; allow only rounding error.
  const difference = Math.abs(data.mask_area_200m_km2 - data.mask_area_100m_km2) / data.mask_area_100m_km2 * 100;
  if (Math.abs(data.mask_sampling_difference_percent - difference) > .0005 || data.total_classified_km2 > data.mask_area_100m_km2 + .1 || (data.masked_nodata_pixels === 0 && Math.abs(data.total_classified_km2 - data.mask_area_100m_km2) > .1)) return false;
  const codes = new Set();
  for (const row of data.classes) {
    if (!row || !Number.isInteger(row.code) || codes.has(row.code) || typeof row.name !== 'string' || !Number.isSafeInteger(row.pixels) || row.pixels < 0 || !Number.isFinite(row.km2) || row.km2 < 0 || !Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100) return false;
    codes.add(row.code);
    if (Math.abs(row.percent - row.km2 / data.total_classified_km2 * 100) > .02) return false;
  }
  return [10,30,40,50,80].every(code => codes.has(code)) && Math.abs(data.classes.reduce((sum,row) => sum + row.km2,0) - data.total_classified_km2) <= .1;
}

export function coverSummaryCsv(data) {
  if (!validCoverSummary(data)) throw new Error('Invalid cover summary');
  const quote = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"','""')}"`;
  };
  const headers = ['class_code','class_name','native_pixels','area_km2','share_percent','denominator_km2','product','geography','method','not_for','mask_100m_km2','mask_200m_km2','mask_difference_percent','masked_nodata_pixels','source_urls','source_sha256','uncertainty_boundary','license','license_url','attribution','citation','citation_url'];
  const boundary = 'Mask sampling sensitivity only; not a confidence interval or local classification accuracy. No county or farm inference.';
  return '\ufeff' + [headers, ...data.classes.map(row => [row.code,row.name,row.pixels,row.km2,row.percent,data.total_classified_km2,data.product,data.geography,data.method,data.not_for,data.mask_area_100m_km2,data.mask_area_200m_km2,data.mask_sampling_difference_percent,data.masked_nodata_pixels,JSON.stringify(data.source_urls),JSON.stringify(data.source_sha256),boundary,data.license,data.license_url,data.attribution,data.citation,data.citation_url])].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
