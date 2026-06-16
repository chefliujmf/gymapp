import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import App from './App'
import Today from './pages/Today'
import Workouts from './pages/Workouts'
import WorkoutDetail from './pages/WorkoutDetail'
import Programs from './pages/Programs'
import ProgramDetail from './pages/ProgramDetail'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import Progress from './pages/Progress'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Today /> },
      { path: 'workouts', element: <Workouts /> },
      { path: 'workouts/:id', element: <WorkoutDetail /> },
      { path: 'programs', element: <Programs /> },
      { path: 'programs/:id', element: <ProgramDetail /> },
      { path: 'recipes', element: <Recipes /> },
      { path: 'recipes/:id', element: <RecipeDetail /> },
      { path: 'progress', element: <Progress /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
