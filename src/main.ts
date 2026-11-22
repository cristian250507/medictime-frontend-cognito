

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_RgBNjdKwq',
      userPoolClientId: '4qusasmmqkuvfj33sdr87pcljm'
    }
  }
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
