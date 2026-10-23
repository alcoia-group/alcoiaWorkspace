import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="page">
      <h1 className="page-title">Page not found</h1>
      <p><Link to="/assignments">Go to your materials</Link></p>
    </section>
  );
}
