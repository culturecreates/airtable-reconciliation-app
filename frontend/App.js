import React from 'react';
import './App.css';
import { Header } from './Header';
import { TabComponent } from './Tabs'

function App() {

    return (
            <div className='whole-content'>
                {/* <Header /> */}
                <div className="row">
                    <TabComponent />
                </div>
            </div>
    );
}

export { App };