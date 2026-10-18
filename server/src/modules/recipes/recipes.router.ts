import { Router, Request, Response } from 'express';
import { RecipesController } from './recipes.controller.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `dish-${Date.now()}-${Math.round(Math.random() * 1e5)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});

export const recipesRouter = Router();

recipesRouter.get('/', RecipesController.getAll);
recipesRouter.get('/:id', RecipesController.getById);
recipesRouter.post('/', RecipesController.create);
recipesRouter.put('/:id', RecipesController.update);
recipesRouter.delete('/:id', RecipesController.delete);

recipesRouter.post('/upload-image', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});
