import { assetBase, useAssetUrl } from '../../lib/assets.js';
import { useLocalImageUrl } from '../../lib/localAssets.js';

// A picture from inside the document. While loading or if it cannot be
// loaded it shows a labelled placeholder rather than disappearing.
export default function AssetImage(props) {
  // A file kept on this device is read out of the file itself; anything else comes from the server.
  return props.asset.local ? <LocalImage {...props} /> : <RemoteImage {...props} />;
}

function RemoteImage({ asset, path, alt, className, style }) {
  const { url, failed } = useAssetUrl(assetBase(asset), path, asset.sessionToken);
  return <Picture url={url} failed={failed} alt={alt} className={className} style={style} />;
}

function LocalImage({ asset, path, alt, className, style }) {
  const { url, failed } = useLocalImageUrl(asset.local, path);
  return <Picture url={url} failed={failed} alt={alt} className={className} style={style} />;
}

function Picture({ url, failed, alt, className, style }) {
  if (url) return <img src={url} alt={alt || ''} className={className} style={style} draggable={false} />;
  return (
    <span className={`asset-placeholder ${className ?? ''}`} style={style}>
      {failed ? `[Image${alt ? `: ${alt}` : ''}]` : ''}
    </span>
  );
}
