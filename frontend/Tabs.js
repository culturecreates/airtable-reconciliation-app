import React, { useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { ArtsdataReconciliationApp } from "./ReconciliationApp";
import Tab from 'react-bootstrap/Tab'
import Tabs from 'react-bootstrap/Tabs'

import "./styles.css";

function TabComponent() {


    const [tabs, setTabs] = useState([
        { id: uuidv4(), name: "Tab 1", content: <ArtsdataReconciliationApp /> }
    ])
    const [key, setKey] = useState(tabs[0].id);

    function handleDoubleClick() {
        setCurrentTabNameEditable(true);
    };

    function handleEditTabName(e) {
        alert("here")
        const updatedTabs = tabs.map(tab => {
            return tab;
        });

        setTabs(updatedTabs);
    };

    function createTabs() {
        const allTabs = tabs.map(tab => {
            return (<Tab key={tab.id} eventKey={tab.id} title={tab.name}>
                {tab.content}
            </Tab>)
        });

        allTabs.push(
            <Tab key={1234} eventKey={'addTab'} title={'+'} onClick={handleAddTab} onDoubleClick={handleDoubleClick}>
            </Tab>
        )

        const content =
            <Tabs id="reconciliation-tabs"
                activeKey={key}
                onSelect={handleSelectTab}
                defaultActiveKey={tabs[0].id}
                className="mb-3"
                onDoubleClick={handleEditTabName}
            >
                {allTabs}
            </Tabs>

        return content;
    };

    function handleSelectTab(tab) {
        if (tab === 'addTab') {
            handleAddTab();
        } else {
            setKey(tab)
        }
    };

    function handleAddTab() {
        const newTabObject = {
            id: uuidv4(),
            name: `Tab ${tabs.length + 1}`,
            content: <ArtsdataReconciliationApp />
        };
        setTabs([...tabs, newTabObject]);
        setKey(newTabObject.id);
    };

    return (
        <div className="container">
            <div className="well">
                {createTabs()}
            </div>
        </div>
    );
}

export { TabComponent }
