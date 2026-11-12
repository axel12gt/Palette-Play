import { createRoot } from 'react-dom/client';
import OfflineGame from './OfflineGame';
import '../src/index.css';
import './offline.css';

createRoot(document.getElementById('root')!).render(<OfflineGame />);
