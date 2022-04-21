import { useBase, Icon, useRecords, TablePicker, FieldPicker, Select } from '@airtable/blocks/ui';
import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import ProgressBar from 'react-bootstrap/ProgressBar'
import { Col, Container, Form, Row } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';

const batchSize = 10;
window.reconciliationProcessActive = [];


function ArtsdataReconciliationApp() {

    const base = useBase();

    const endpointOptions = [
        { value: "ArtsData.ca", label: "Artsdata.ca Reconciliation Service" }
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

    function onCancelReconciliation() {
        const processId = currentProcessId;
        setReconciliationActiveStatus(processId, false);
        setUpdateInProgress(false);
        clearStats();
        console.log(`Reconciliation process cancelled.`)
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
            const trueMatch = artsdataResult?.[`q${count}`]?.['result'].filter(m => m.match === true)
            if (trueMatch?.length === 1) {
                singleMatchCount++;
                matches.push({ recordId: record.id, artsdataId: trueMatch[0].id });
            } else if (trueMatch?.length === 0) {
                multipleCadidateCount++;
                matches.push({ recordId: record.id, artsdataId: "" });
            } else {
                noMatchCount++;
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
        setTrueMatchCount(0);
        setMultiMatchCount(0);
        setUnmatchedCount(0);
        setMultiMatchPercentage(0);
    }

    return (
        <Container className='content' >
            <Form className='form'>

                <Row >
                    <Col sm={4}>Table</Col>
                    <Col sm={8}>
                        <TablePicker
                            placeholder='Select a table'
                            table={tableSelected}
                            onChange={newTable => setTableSelected(newTable)}
                            width="380px"
                            size="large"
                            backgroundColor="white"
                        />
                    </Col>
                </Row>
                {tableSelected ? (
                    <Row >
                        <Col sm={4}>Name</Col>
                        <Col sm={8}>
                            <FieldPicker
                                placeholder='Select a field'
                                table={table}
                                field={entityNameField}
                                onChange={newField => setEntityNameField(newField)}
                                width="380px"
                                size="large"
                            />
                        </Col>
                    </Row>
                ) : (<></>)}
                <Row >
                    <Col><Icon name="chevronRight" size={16} /></Col>
                    <Col >
                        <Select
                            options={endpointOptions}
                            value={endPoint}
                            onChange={endPoint => setEndPoint(endPoint)}
                            width="550px"
                            size="large"

                        /></Col>
                </Row>

                <Row onChange={onChangeEntityType} style={{ lineHeight: "1.5", paddingTop: "1.5px" }}  >
                    <Col sm={4}>Type</Col>
                    <Col sm={8}>
                        <Row >
                            <Col sm={1}><input type="radio" value="Person" name="entityType" /></Col>
                            <Col sm={3}>Person </Col></Row>
                        <Row >
                            <Col sm={1} ><input type="radio" value="Place" name="entityType" /></Col>
                            <Col sm={3}> Place </Col>
                        </Row>
                        <Row >
                            <Col sm={1}><input defaultChecked type="radio" value="Organization" name="entityType" /></Col >
                            <Col sm={3}> Organization </Col>
                        </Row>
                    </Col>
                </Row>
                <Row>
                    <Col sm={4}>Properties</Col>
                    <Col sm={8}><button className='button1' type="button" disabled={true}>Add property</button></Col>
                </Row>
                {tableSelected ? (
                    <Row  >
                        <Col sm={4} >Result </Col>
                        <Col sm={8}>
                            <FieldPicker
                                placeholder='Select a field'
                                table={table}
                                field={resultField}
                                onChange={result => setResultField(result)}
                                width="380px"
                                size="large"
                            />
                        </Col>
                    </Row>
                ) : (<></>)}
                <div style={{ textAlign: 'center', lineHeight: 3 }}>
                    <input type="checkbox" onChange={value => setReconcileAlways(value)} />
                    {`  Keep reconciled at all times`}
                    <Row className="justify-content-md-center" xs lg="1">
                        <Col><button
                            onClick={onButtonClick}
                            disabled={!permissionCheck.hasPermission}
                            className="button2"
                            type="button"> <b>Reconcile</b>
                        </button></Col>
                    </Row>
                </div>
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
                        <Row className="justify-content-md-center">{reconciliationProgress}%</Row>
                        <Container >
                            <Row style={{ 'textAlign': 'left' }}>
                                <Col style={{ 'textAlign': 'left', 'marginLeft': '200px' }}>
                                    <Row >
                                        <Col sm={3}>{trueMatchCount}</Col>
                                        <Col sm={9}> matched</Col>
                                    </Row>
                                    <Row >
                                        <Col sm={3} >{unmatchedCount}</Col>
                                        <Col sm={9}> not matched</Col>
                                    </Row>
                                    <Row >
                                        <Col sm={3}>{multiMatchCount}</Col>
                                        <Col sm={9}> multiple candidates </Col>
                                    </Row>
                                </Col>
                            </Row>
                            <br />
                            {(multiMatchPercentage > 10) ? (
                                <Row>
                                    <Col>
                                        <h3 className='h3'>Please add properties to increase matches</h3>
                                    </Col>
                                </Row>) : (<></>)}
                        </Container>
                    </div>
                ) : (<></>)
            }
        </Container>
    );

}

export { ArtsdataReconciliationApp }
