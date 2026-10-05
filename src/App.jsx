import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SignInPage from './pages/SignInPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import AssignmentsPage from './pages/AssignmentsPage.jsx';
import ReaderGate from './components/ReaderGate.jsx';
import InvitePage from './pages/InvitePage.jsx';
import LtiJoinPage from './pages/LtiJoinPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ExamPage from './pages/ExamPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/assignments" replace />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/auth-verify" element={<VerifyPage />} />
        <Route path="/invite/accept" element={<InvitePage />} />
        <Route path="/lti/join" element={<LtiJoinPage />} />
        {/* /a/<uuid> is the shape the product plan names for the reader. It
            handles its own auth: an extension handoff code signs the student
            in directly, otherwise it falls back to the sign-in page. */}
        <Route path="/a/:assignmentId" element={<ReaderGate />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/exam" element={<ExamPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
