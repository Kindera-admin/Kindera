// Ask Cloudinary for a resized, auto-format, auto-quality version of an
// uploaded image. Non-Cloudinary URLs, raw files (PDF/Word) and URLs that
// already carry a transformation are returned unchanged.
export function cldImage(url, width) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com/') || !url.includes('/image/upload/')) return url;
  const [base, rest] = url.split('/image/upload/');
  if (/^(?:[a-z]{1,3}_[^/]+,?)+\//.test(rest)) return url;
  return `${base}/image/upload/f_auto,q_auto,c_limit,w_${width}/${rest}`;
}
