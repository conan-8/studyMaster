import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import ZenScreen from './components/ZenScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/zen" element={<ZenScreen />} />
    </Routes>
  )
}
