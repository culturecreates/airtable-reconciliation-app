import React from 'react';
import './App.css';
import { Header } from './Header';
import { ArtsdataReconciliationApp} from './ReconciliationApp'
import {TabComponent} from './Tabs'

function App() {

    return (
        <div>
            <Header />
            <div className="row">
                {/* <ArtsdataReconciliationApp/>
                 */}
                 <TabComponent/>
            </div>
        </div>
    );
}

export { App };