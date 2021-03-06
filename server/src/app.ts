import {
  encryptCredential,
  getToken,
  validateCredential,
} from './utils/auth';
import { resetPassword, verifyEmail } from './types/models/User';

import FilesystemBackend from 'i18next-node-fs-backend';
import cors from 'cors';
import ejs from 'ejs';
import express from 'express';
import fs from 'fs';
import i18next from 'i18next';
import middleware from 'i18next-express-middleware';
import multer from 'multer';
import path from 'path';
import qs from 'querystring';
import { uploadFileToAzureBlobFromFile } from './utils/azure';

// eslint-disable-next-line
require('dotenv').config();

const {
  STORAGE_ENDPOINT,
  NODE_ENV,
  REDIRECT_URL,
} = process.env;

i18next
  .use(middleware.LanguageDetector)
  .use(FilesystemBackend)
  .init({
    lng: 'en',
    preload: ['en', 'ko'],
    load: 'languageOnly',
    backend: {
      loadPath: path.join(__dirname, '../locales', '{{lng}}.json'),
      addPath: path.join(__dirname, '../locales', '{{lng}}.missing.json'),
    },
    fallbackLng: ['en', 'ko'],
    saveMissing: true,
    debug: false,
  });

export const createApp = (): express.Application => {
  const app = express();

  const filePath = path.join(__dirname, '../files');

  app.use(cors());
  app.use(middleware.handle(i18next));
  app.use(express.static(filePath));

  app.set('views', path.join(__dirname, '../html'));
  app.engine('html', ejs.renderFile);
  app.set('view engine', 'html');

  app.get('/reset_password/:email/:hashed/:password', async (req: ReqI18n, res) => {
    const email = qs.unescape(req.params.email);
    const hashed = qs.unescape(req.params.hashed);
    const randomPassword = qs.unescape(req.params.password);

    try {
      const validated = await validateCredential(email, hashed);
      if (validated) {
        const password = await encryptCredential(randomPassword);
        await resetPassword(email, password);
        return res.render('password_changed', {
          title: req.t('PW_CHANGED_TITLE'),
          text: req.t('PW_CHANGED'),
          SERVICE_CENTER: req.t('SERVICE_CENTER'),
        });
      }
      res.send('Error occured. Plesae try again.');
    } catch (err) {
      res.send('Error occured. Plesae try again.');
    }
  });
  app.get('/verify_email/:email/:hashed', async (req: ReqI18n, res) => {
    const email = qs.unescape(req.params.email);
    const hashed = qs.unescape(req.params.hashed);

    try {
      const validated = await validateCredential(email, hashed);
      if (validated) {
        await verifyEmail(email);
        return res.render('email_verified', {
          REDIRECT_URL,
          TITLE: req.t('EMAIL_VERIFIED_TITLE'),
          TEXT: req.t('EMAIL_VERIFIED'),
          SERVICE_CENTER: req.t('SERVICE_CENTER'),
          GO_TO_SIGN_IN: req.t('GO_TO_SIGN_IN'),
        });
      }
      res.send('Error occured. Plesae try again.');
    } catch (err) {
      res.send('Error occured. Plesae try again.');
    }
  });

  app.post(
    '/upload_single',
    multer({ dest: './files' }).single('inputFile'),
    async (req, res) => {
      interface Result {
        message: string | unknown;
        status: number;
        url?: string;
      }

      const result: Result = {
        message: '',
        status: 0,
      };

      const token = getToken(req);

      if (!token) {
        result.message = 'User has not signed in.';
        result.status = 401;
        return res.json(result);
      }

      if (!req.file) {
        result.message = 'File is missing.';
        result.status = 400;
        return res.json(result);
      }

      const dir: string = req.body.dir ? req.body.dir : 'defaults';
      try {
        const resultUpload = await uploadFileToAzureBlobFromFile(
          `./files/${req.file.filename}`,
          req.file.filename,
          dir,
        );
        result.status = 200;
        result.message = resultUpload;
        result.url = `${STORAGE_ENDPOINT}/${dir}/${req.file.filename}`;
        res.json(result);
      } catch (err) {
        result.message = err;
        result.status = 400;
        res.json(result);
      } finally {
        fs.unlink(`./files/${req.file.filename}`, () => {
          // eslint-disable-next-line no-console
          console.log(`Local temp file deleted: ${req.file.filename}`);
        });
      }
    },
  );

  app.get('/', (req, res) => {
    // @ts-ignore
    res.send(`${req.t('IT_WORKS')} - Version 0.0.1\nENV: ${NODE_ENV}`);
  });

  return app;
};
