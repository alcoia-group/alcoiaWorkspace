import logo from '../assets/img/alcoia-logo.png';

// The cream-tile logo carries its own background, so it reads the same on the
// dark top bar, the grey page and the white sign-in box. Do not swap in a
// transparent variant: its black letters vanish on the dark bar.
export default function Logo({ className = '' }) {
  return <img src={logo} alt="alcoia" className={`logo ${className}`} draggable={false} />;
}
