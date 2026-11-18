import 'dotenv/config';
import { crearApp } from './app.js';

const port = process.env.PORT || 4000;
crearApp().listen(port, () => console.log(`ms-ventas escuchando en http://localhost:${port}`));
