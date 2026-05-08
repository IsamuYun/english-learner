import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Flashcards from './pages/Flashcards'
import Conversation from './pages/Conversation'
import Reading from './pages/Reading'
import Essay from './pages/Essay'
import Settings from './pages/Settings'
import Manage from './pages/Manage'
import Login from './pages/Login'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route element={<RequireAuth />}>
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="conversation" element={<Conversation />} />
          <Route path="reading" element={<Reading />} />
          <Route path="essay" element={<Essay />} />
          <Route path="manage" element={<Manage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}
