import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import ZenScreen from './components/ZenScreen'
import Review from './pages/Review'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/zen" element={<ZenScreen />} />
      <Route path="/review" element={<Review />} />
    </Routes>
  )
}
