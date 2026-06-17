import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import App from './App'
import Today from './pages/Today'
import Train from './pages/Train'
import Workouts from './pages/Workouts'
import WorkoutDetail from './pages/WorkoutDetail'
import Programs from './pages/Programs'
import ProgramDetail from './pages/ProgramDetail'
import Trainers from './pages/Trainers'
import TrainerDetail from './pages/TrainerDetail'
import Eat from './pages/Eat'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import Mind from './pages/Mind'
import MindDetail from './pages/MindDetail'
import Profile from './pages/Profile'
import Progress from './pages/Progress'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Today /> },
      { path: 'train', element: <Train /> },
      { path: 'workouts', element: <Workouts /> },
      { path: 'workouts/:id', element: <WorkoutDetail /> },
      { path: 'programs', element: <Programs /> },
      { path: 'programs/:id', element: <ProgramDetail /> },
      { path: 'trainers', element: <Trainers /> },
      { path: 'trainers/:id', element: <TrainerDetail /> },
      { path: 'eat', element: <Eat /> },
      { path: 'recipes', element: <Recipes /> },
      { path: 'recipes/:id', element: <RecipeDetail /> },
      { path: 'mind', element: <Mind /> },
      { path: 'mind/:id', element: <MindDetail /> },
      { path: 'profile', element: <Profile /> },
      { path: 'progress', element: <Progress /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
