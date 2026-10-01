import darkLetters from '../assets/img/alcoia-logo-dark-letters.png';
import whiteLetters from '../assets/img/alcoia-logo-white-letters.png';

// Both files have a transparent ground. White letters are for dark surfaces
// (the top bar is always dark). `adaptive` picks by colour scheme: black
// letters on the light theme, white on the dark one.
export default function Logo({ onDark = false, adaptive = false, className = '' }) {
  if (adaptive) {
    return (
      <>
        <img src={darkLetters} alt="alcoia" className={`logo logo-light-only ${className}`} draggable={false} />
        <img src={whiteLetters} alt="alcoia" className={`logo logo-dark-only ${className}`} draggable={false} />
      </>
    );
  }
  return <img src={onDark ? whiteLetters : darkLetters} alt="alcoia" className={`logo ${className}`} draggable={false} />;
}
