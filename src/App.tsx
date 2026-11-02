import { createBrowserRouter, RouterProvider } from 'react-router'
import GuestPage from './pages/GuestPage'
import HostPage from './pages/HostPage'

const router = createBrowserRouter([
  { path: '/', element: <GuestPage /> },
  { path: '/host', element: <HostPage /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
