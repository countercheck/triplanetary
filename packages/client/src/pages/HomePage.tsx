import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main>
      <h1>Triplanetary</h1>
      <p>A digital adaptation of the classic space movement game.</p>
      <nav>
        <Link to="/lobby">Play</Link>
        {' · '}
        <Link to="/login">Login</Link>
        {' · '}
        <Link to="/register">Register</Link>
      </nav>
    </main>
  );
}
