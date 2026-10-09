import { assetBase, useAssetUrl } from '../../lib/assets.js';

// A picture from inside the document. While loading or if it cannot be
// loaded it shows a labelled placeholder rather than disappearing.
export default function AssetImage({ asset, path, alt, className, style }) {
  const { url, failed } = useAssetUrl(assetBase(asset), path, asset.sessionToken);
  if (url) return <img src={url} alt={alt || ''} className={className} style={style} draggable={false} />;
  return (
    <span className={`asset-placeholder ${className ?? ''}`} style={style}>
      {failed ? `[Image${alt ? `: ${alt}` : ''}]` : ''}
    </span>
  );
}
