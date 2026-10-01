import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="app-main">
      <h1>Page not found</h1>
      <p><Link to="/assignments">Go to your assignments</Link></p>
    </section>
  );
}
