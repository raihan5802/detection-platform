import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import UserHome from './pages/UserHome';
import ProjectImageHome from './pages/ProjectImageHome';

import Detection from './pages/ImageAnnotation/DetectionPages/Detection';


import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Tasks from './pages/Tasks';
import TasksImageHome from './pages/TasksImageHome'
import TaskInfo from './pages/TaskInfo';
import Projects from './pages/Projects';
import ProjectInfo from './pages/ProjectInfo';



function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/userhome" element={<UserHome />} />
      <Route path="/images" element={<ProjectImageHome />} />
      <Route path="/tasks-image-home" element={<TasksImageHome />} />

      <Route path="/detection" element={<Detection />} />

      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/project-info/:projectId" element={<ProjectInfo />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/task-info/:taskId" element={<TaskInfo />} />



    </Routes>
  );
}

export default App;