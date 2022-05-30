import {Icon, Text, useBase, useRecords, TablePicker, FieldPicker,FormField, SelectButtons, Button, Select, Switch } from '@airtable/blocks/ui';
import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import ProgressBar from 'react-bootstrap/ProgressBar'
import { Col, Container, Form, Row } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { confirm } from "react-confirm-box";

const batchSize = 10;
window.reconciliationProcessActive = [];


function ArtsdataReconciliationApp() {

    const base = useBase();
    const endpointOptions = [
        { value: "Artsdata.ca", label: "Artsdata.ca" },
        { value: "Wikidata.org", label: "Wikidata.org (en)" }
    ];
    const headersRequest = {
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "if-none-match": "W/\"ad470517ef67dbaa1eac01387aed83f4\"",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"99\", \"Google Chrome\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Linux\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "Referer": "https://reconciliation-api.github.io/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    };

    const [tableSelected, setTableSelected] = useState(null);
    const [entityNameField, setEntityNameField] = useState(null);
    const [resultField, setResultField] = useState(null);
    const [table, setTable] = useState(null);
    const [fetchTable, setFetchTable] = useState(true);
    const [entityType, setEntityType] = useState('Organization');
    const [endPoint, setEndPoint] = useState(endpointOptions[0].value);
    const [isUpdateInProgress, setUpdateInProgress] = useState(false);
    const [currentProcessId, setCurrentProcessId] = useState(null);

    let [trueMatchCount, setTrueMatchCount] = useState(0);
    let [unmatchedCount, setUnmatchedCount] = useState(0);
    let [multiMatchCount, setMultiMatchCount] = useState(0);
    let [multiMatchPercentage, setMultiMatchPercentage] = useState(0);
    const [reconciliationProgress, setReconcliationProgress] = useState(0);

    useEffect(() => {
        setEntityNameField(null);
        setResultField(null);
        setFetchTable(true);
        clearStats();
    }, [tableSelected])

    if (!!tableSelected && fetchTable) {
        setFetchTable(false);
        setTable(base.getTableByName(tableSelected.name));
    }

    const records = useRecords(table);
    const permissionCheck = (!!tableSelected && !!entityNameField && !!entityType && !!resultField && !isUpdateInProgress) &&
        table.checkPermissionsForUpdateRecord(undefined, { [resultField.name]: undefined });

    function setReconciliationActiveStatus(processId, status) {
        window.reconciliationProcessActive[processId] = status
    }

    async function onButtonClick() {
        const processId = `reconcile_` + uuidv4();
        setCurrentProcessId(processId);
        console.log("Reconciliation started")
        setReconciliationActiveStatus(processId, true);
        setUpdateInProgress(true);
        await reconcileAndExtractArtsdataIds(processId, table, records, entityNameField, resultField, entityType);
        setReconciliationActiveStatus(processId, false);
        setUpdateInProgress(false);
    }

    async function onCancelReconciliation() {
        const result = await confirm("Are you sure?");
        if (result) {
            const processId = currentProcessId;
            setReconciliationActiveStatus(processId, false);
            setUpdateInProgress(false);
            clearStats();
            console.log(`Reconciliation process cancelled.`)
        }

    }

    function onChangeEntityType(event) {
        setEntityType(event.target.value);
    }

    async function reconcileAndExtractArtsdataIds(processId, table, records, entityNameField, artsdataIdField, entityType) {
        let trueMatchCounts = 0;
        let multiMatchesCounts = 0;
        let noMatchesCounts = 0;
        const entityNames = records.map(record => record.getCellValueAsString(entityNameField))
        let offset = 0;
        let recordCount = entityNames.length;
        setReconcliationProgress(0);

        while (window.reconciliationProcessActive?.[processId]) {
            console.log(`Reconciling ${offset} to ${offset + batchSize}`)
            const currentNames = entityNames.slice(offset, offset + batchSize);
            const currentRecords = records.slice(offset, offset + batchSize);
            const encodedUrl = generateQuery(currentNames, entityType);
            try {
                const response = await fetch(encodedUrl, { cors: true, headers: headersRequest, method: "GET" });
                const artsDataResult = await response.json();
                let matchResult = findMatches(currentRecords, artsDataResult);
                updateAirtableWithArtsdataIds(table, matchResult.matches, artsdataIdField);

                trueMatchCounts = trueMatchCounts + matchResult.singleMatchCount;
                multiMatchesCounts = multiMatchesCounts + matchResult.multipleCadidateCount;
                noMatchesCounts = noMatchesCounts + matchResult.noMatchCount;

                setTrueMatchCount(trueMatchCounts);
                setMultiMatchCount(multiMatchesCounts);
                setUnmatchedCount(noMatchesCounts);
                setMultiMatchPercentage(((multiMatchesCounts / recordCount) * 100).toFixed(2));
            } catch (error) {
                console.error(`Error occured during reconcilation.
                error: ${error}
                Encoded URl : ${encodedUrl} `);
            }
            offset = offset + batchSize;
            const reconciliationProgress = (offset / recordCount) * 100;
            setReconcliationProgress(reconciliationProgress.toFixed(2));
            if (offset > recordCount) {
                console.log("Reconciliation completed")
                break;
            }
        }
    }

    function updateAirtableWithArtsdataIds(table, trueMatches, artsdataIdField) {
        const recordUpdates = []
        for (const trueMatch of trueMatches) {
            recordUpdates.push({
                id: trueMatch.recordId,
                fields: {
                    [artsdataIdField.name]: trueMatch.artsdataId
                }
            });
        }
        updateRecordsInBatchesAsync(table, recordUpdates);
    }

    function findMatches(currentRecords, artsdataResult) {
        let matches = [];
        let count = 0;
        let singleMatchCount = 0;
        let multipleCadidateCount = 0;
        let noMatchCount = 0;
        for (const record of currentRecords) {
            const result = artsdataResult?.[`q${count}`]?.['result'];
            const trueMatch = result.filter(m => m.match === true)
            if (result.length === 0) {
                //if no candidates
                noMatchCount++;
                matches.push({ recordId: record.id, artsdataId: '' });
            }
            else if (trueMatch?.length === 1) {
                //if one and only true match
                singleMatchCount++;
                matches.push({ recordId: record.id, artsdataId: trueMatch[0].id });
            } else if (trueMatch?.length > 1 || records.length > 0) {
                //Either more than one true matches
                //or multiple candidates with no true match
                multipleCadidateCount++;
                matches.push({ recordId: record.id, artsdataId: "" });
            }
            count++;
        }
        return { matches, singleMatchCount, multipleCadidateCount, noMatchCount };
    }

    function generateQuery(names, type) {
        const baseUrl = 'https://api.artsdata.ca/recon?queries='
        let query = '{'
        let subQuery;
        let count = 0;
        for (const name of names) {
            subQuery = `"q${count}":{"query":"${name}","type":"${type}"},`
            query = query.concat(subQuery);
            count++;
        }
        query = query.slice(0, -1);
        query = query.concat("}");
        return `${baseUrl}${encodeURIComponent(query)}&timeout=2000`;
    }

    async function updateRecordsInBatchesAsync(table, recordUpdates) {
        await table.updateRecordsAsync(recordUpdates);
    }

    function clearStats() {
        // setTrueMatchCount(0);
        // setMultiMatchCount(0);
        // setUnmatchedCount(0);
        // setMultiMatchPercentage(0);
    }

    
    const typeOptions = [
        { value: "Person", label: "Person" },
        { value: "Place", label: "Place" },
        { value: "Organization", label: "Organization" }
      ];

      const SelectButtonsReconType = () => {
        const [value, setValue] = useState( typeOptions[0].value);
        return (
          <SelectButtons
            value={value}
            onChange={newValue => setValue(newValue)}
            options={typeOptions}
            width="320px"
          />
        );
      };

      const SwitchKeepReconcilied = () => {
        const [isEnabled, setIsEnabled] = useState(false);
        return (
          <Switch
            value={isEnabled}
            onChange={newValue => setIsEnabled(newValue)}
            label="Keep reconciled at all times"
            size="large"
            backgroundColor="transparent"
            width="320px"
          />
        );
      };

    return (
        <Container className='content' >
            <Form className='form'>
                <FormField label="Reconciliation service">
                    <Select
                        options={endpointOptions}
                        value={endPoint}
                        onChange={endPoint => setEndPoint(endPoint)}
                        size="large"
                    />
                </FormField>
                <FormField label="Type">
                    {SelectButtonsReconType()} 
                </FormField>

                <FormField label="Table">
                    <TablePicker
                        placeholder='Select a table'
                        table={tableSelected}
                        onChange={newTable => setTableSelected(newTable)}
                        /*width="380px" */
                        size="large"
                        backgroundColor="white"
                    />
                </FormField>

            
                {tableSelected ? (
                    <FormField label="Field to reconcile">
                        <FieldPicker
                            placeholder='Select a field to reconcile'
                            table={table}
                            field={entityNameField}
                            onChange={newField => setEntityNameField(newField)}
                            // width="380px"
                            size="large"
                        />
                     </FormField>
                ) : (<></>)}         
               
                {/* 
                <Row onChange={onChangeEntityType} style={{ lineHeight: "1.5", paddingTop: "1.5px" }}  >
                </Row> */}       
               
                {entityNameField ? (
                    <FormField label="Store results">
                        <FieldPicker
                            placeholder='Select field to store result'
                            table={table}
                            field={resultField}
                            onChange={result => setResultField(result)}
                            // width="380px"
                            size="large"
                        />
                    </FormField>
                   
                ) : (<></>)} 
               
              
               <center> 
                    <Button
                        onClick={onButtonClick}
                        disabled={!permissionCheck.hasPermission}
                        className="button2"
                        type="button"
                        variant="primary"
                        size="large"
                    >
                    Reconcile
                    </Button>
                    </center>
                {!permissionCheck.hasPermission && permissionCheck.reasonDisplayString}
            </Form >
            <br />
            {
                (isUpdateInProgress) ? (
                    <div style={{ lineHeight: '2' }}>
                        <Row className="justify-content-md-center">
                            <Col md={{ span: 10 }}><ProgressBar animated now={reconciliationProgress} /></Col>
                            <Col md={{ span: 2 }} className='clickableText' onClick={onCancelReconciliation} >Cancel</Col>
                        </Row>
                        {/* <Row className="justify-content-md-center">{reconciliationProgress}%</Row> */}
                        <Container >
                            <Row style={{ 'textAlign': 'left' }}>
                                <Col style={{ 'textAlign': 'left', 'marginLeft': '20px' }}>
                                    <Row >
                                    <span>{trueMatchCount} matched</span>
                                    </Row>
                                    <Row >
                                    <span> {unmatchedCount} not matched</span>
                                    </Row>
                                    <Row >
                                        <span>{multiMatchCount} multiple candidates <a href="#">fix</a></span>
                                    </Row>
                                    <Row >
                                        <span>0 manually entered <a href="#">clear</a></span>
                                    </Row>
                                </Col>
                            </Row>
                           
                        </Container>
                        <br />
                        {(multiMatchPercentage > 10) ? (
                            <Container >
                                <Row>
                                    <Col>
                                   <Text size="large">Tip: add <a href="#">properties</a> to increase matches!</Text>
                                    </Col>
                                </Row>
                            </Container> 
                        ) : (<></>)}         
                    </div>
                ) : (<></>)
            }
             <br />
            <span> {SwitchKeepReconcilied()}</span>
        </Container>
    );
}

export { ArtsdataReconciliationApp }