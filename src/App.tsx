import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Flashcards from './pages/Flashcards'
import Conversation from './pages/Conversation'
import Reading from './pages/Reading'
import Essay from './pages/Essay'
import Settings from './pages/Settings'
import Manage from './pages/Manage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/conversation" element={<Conversation />} />
        <Route path="/reading" element={<Reading />} />
        <Route path="/essay" element={<Essay />} />
        <Route path="/manage" element={<Manage />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}
