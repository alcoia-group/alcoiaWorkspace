import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SignInPage from './pages/SignInPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import AssignmentsPage from './pages/AssignmentsPage.jsx';
import ReaderPage from './pages/ReaderPage.jsx';
import InvitePage from './pages/InvitePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/assignments" replace />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/auth-verify" element={<VerifyPage />} />
        <Route path="/invite/accept" element={<InvitePage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/assignments" element={<AssignmentsPage />} />
          {/* /a/<uuid> is the shape the product plan names for the reader. */}
          <Route path="/a/:assignmentId" element={<ReaderPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
