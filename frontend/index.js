import { initializeBlock } from '@airtable/blocks/ui';
import { ArtsdataReconciliationApp } from './ReconciliationApp'
import {App} from './App'
import React from 'react';


initializeBlock(() => <App />);
// initializeBlock(() => <ArtsdataReconciliationApp />);

