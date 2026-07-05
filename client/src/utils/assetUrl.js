export const assetUrl = (assetPath) => {
  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const normalizedPath = assetPath.replace(/^\//, '');
  return publicUrl ? `${publicUrl}/${normalizedPath}` : `/${normalizedPath}`;
};
