import { useBase, Icon, Box, useRecords, TablePicker, FieldPicker, Select } from '@airtable/blocks/ui';
import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import ProgressBar from 'react-bootstrap/ProgressBar'
import { Col, Container, Row } from 'react-bootstrap';

const clickableText = {
    color: 'blue', 'textDecoration': 'underline', cursor: 'pointer', 'fontSize': '90%', 'lineHeight': 4
}

const stats = {
    span: 1, offset: 4
}

let reconActive = false;

function ArtsdataReconciliationApp() {

    const base = useBase();

    const endpointOptions = [
        { value: "ArtsData.ca", label: "Artsdata.ca Reconciliation Service" }
    ];

    const [tableSelected, setTableSelected] = useState(null);
    const [entityNameField, setEntityNameField] = useState(null);
    const [shouldReconcileAlways, setReconcileAlways] = useState(false);
    const [resultField, setResultField] = useState(null);
    const [table, setTable] = useState(null);
    const [isTableNameEmpty, setIsTableNameEmpty] = useState(true);
    const [entityType, setEntityType] = useState('Organization');
    const [endPoint, setEndPoint] = useState(endpointOptions[0].value);
    const [reconciliationProgress, setReconcliationProgress] = useState(0);
    const [isReconciliationActive, setReconciliationActive] = useState(false);

    let [trueMatchCount, setTrueMatchCount] = useState(0);
    let [unmatchedCount, setUnmatchedCount] = useState(0);
    let [multiMatchCount, setMultiMatchCount] = useState(0);
    let [multiMatchPercentage, setMultiMatchPercentage] = useState(0);
    

    if (!!tableSelected && isTableNameEmpty) {
        setIsTableNameEmpty(false);
        setTable(base.getTableByName(tableSelected.name));
    }

    const records = useRecords(table);
    const permissionCheck = (!!tableSelected && !!entityNameField && !!entityType && !!resultField) &&
        table.checkPermissionsForUpdateRecord(undefined, { [resultField.name]: undefined });

    async function onButtonClick() {
        console.log("Reconciliation started")
        reconActive = true;
        setReconciliationActive(true);
        await reconcileAndExtractArtsdataIds(table, records, entityNameField, resultField, entityType)
        reconActive = false;
        console.log("Reconciliation completed")
    }

    function onCancelReconciliation() {
        setReconciliationActive(false);
        reconActive = false;
        alert(`Aborting reconciliation`)
    }

    function onChangeEntityType(event) {
        setEntityType(event.target.value);
    }

    return (
        <Box
            flex="none"
            display="flex"
            flexDirection="column"
            width="300px"
            backgroundColor="white"
        >
            <Container fluid="sm" className='content' >
                <form>
                    <Row className="justify-content-md-center" >
                        <Col xs="auto"><Icon name="chevronRight" size={16} /></Col>
                        <Col xs="auto">
                            <Select
                                options={endpointOptions}
                                value={endPoint}
                                onChange={endPoint => setEndPoint(endPoint)}
                                width="270px"
                                marginLeft={"2px"}
                                size="large"
                            /></Col>
                    </Row>
                    <Row className="justify-content-md-center">
                        <Col xs="auto">Table</Col>
                        <Col xs="auto">
                            <TablePicker
                                placeholder='Select a table'
                                table={tableSelected}
                                onChange={newTable => setTableSelected(newTable)}
                                width="240px"
                                size="large"
                            />
                        </Col>
                    </Row>
                    {tableSelected ? (
                        <Row className="justify-content-md-center">
                            <Col xs="auto">Name</Col>
                            <Col xs="auto">
                                <FieldPicker
                                    placeholder='Select a field'
                                    table={table}
                                    field={entityNameField}
                                    onChange={newField => setEntityNameField(newField)}
                                    width="240px"
                                    size="large"
                                />
                            </Col>
                        </Row>
                    ) : (<></>)}

                    <Row onChange={onChangeEntityType}  >
                        <Col md={{ span: 1, offset: 3 }}>Type</Col>
                        <Col>
                            <Row > <Col md={{ span: 3 }}><input type="radio" value="Person" name="entityType" /></Col> Person </Row>
                            <Row > <Col md={{ span: 3 }}><input type="radio" value="Place" name="entityType" /></Col> Place </Row>
                            <Row > <Col md={{ span: 3 }}><input defaultChecked type="radio" value="Organization" name="entityType" /></Col > Organization </Row>
                        </Col>
                    </Row>
                    <Row className="justify-content-md-center">
                        <Col xs="auto">Properties</Col>
                        <Col md={{ span: 2, offset: 2 }}><button className='button1' type="button" disabled={true}>Add property</button></Col>
                    </Row>
                    {tableSelected ? (
                        <Row className="justify-content-md-center" >
                            <Col xs="auto" >Result </Col>
                            <Col xs="auto">
                                <FieldPicker
                                    placeholder='Select a field'
                                    table={table}
                                    field={resultField}
                                    onChange={result => setResultField(result)}
                                    width="230px"
                                    size="large"
                                />
                            </Col>
                        </Row>
                    ) : (<></>)}
                    <Row className="justify-content-md-center" >
                        <Col xs="auto"><input type="checkbox" onChange={value => setReconcileAlways(value)} /></Col>
                        <Col xs="auto">Keep reconciled at all times</Col>
                    </Row>
                    <br />
                    <Row className="justify-content-md-center" xs lg="1">
                        <Col><button onClick={onButtonClick}
                            disabled={!permissionCheck.hasPermission}
                            type="button"> Reconcile</button></Col>
                    </Row>
                    {!permissionCheck.hasPermission && permissionCheck.reasonDisplayString}
                </form >
                <br />
                {
                    (reconActive) ? (
                        <div>
                            <Row className="justify-content-md-center">
                                <Col md={{ span: 8 }}><ProgressBar animated now={reconciliationProgress} /></Col>
                                <Col md={{ span: 1 }} style={clickableText} onClick={onCancelReconciliation} >Cancel</Col>
                            </Row>
                            <Row className="justify-content-md-center">{reconciliationProgress}%</Row>
                            <Container >
                                <Row >
                                    <Col className="justify-content-md-center-left">
                                        <Row >
                                            <Col md={stats}>{trueMatchCount}</Col>
                                            <Col xs="auto"> matched</Col>
                                        </Row>
                                        <Row >
                                            <Col md={stats} >{unmatchedCount}</Col>
                                            <Col xs="auto"> not matched</Col>
                                        </Row>
                                        <Row >
                                            <Col md={stats}>{multiMatchCount}</Col>
                                            <Col xs="auto"> multiple candidates </Col>
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
        </Box >
    );

    async function reconcileAndExtractArtsdataIds(table, records, entityNameField, artsdataIdField, entityType) {
        const entityNames = records.map(record => record.getCellValueAsString(entityNameField))
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
        let trueMatches = [];
        const batchSize = 10;
        let offset = 0;
        const totalNames = entityNames.length;
        setReconcliationProgress(0);
        while (isReconciliationActive) {
            if (!reconActive) {
                alert("Aborting reconciliation")
                return;
            }
            console.log(`Reconciling ${offset} to ${offset + batchSize}`)
            const currentNames = entityNames.slice(offset, offset + batchSize);
            const currentRecords = records.slice(offset, offset + batchSize);
            const encodedUrl = generateQuery(currentNames, entityType);
            try {
                const response = await fetch(encodedUrl, { cors: true, headers: headersRequest, method: "GET" });
                const artsDataResult = await response.json();
                trueMatches = findTrueMatches(currentRecords, artsDataResult);
                updateAirtableWithArtsdataIds(table, trueMatches, artsdataIdField);
            } catch (error) {
                console.error(`Error occured during reconcilation.
                error: ${error}
                Encoded URl : ${encodedUrl} `);
            }
            offset = offset + batchSize;
            if (offset > totalNames) {
                break;
            }
            const progress = (offset / totalNames) * 100;
            setReconcliationProgress(progress.toFixed(2));
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


    function findTrueMatches(currentRecords, artsdataResult) {
        let trueMatches = [];
        let count = 0;
        for (const record of currentRecords) {
            const trueMatch = artsdataResult?.[`q${count}`]?.['result'].filter(m => m.match === true)
            if (trueMatch?.length === 1) {
                setTrueMatchCount(trueMatchCount++);
                trueMatches.push({ recordId: record.id, artsdataId: trueMatch[0].id });
            } else if (trueMatch?.length === 0) {
                setMultiMatchCount(multiMatchCount++);
                trueMatches.push({ recordId: record.id, artsdataId: "" });
            } else {
                setUnmatchedCount(unmatchedCount++);
            }
            count++;
        }
        return trueMatches;
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

}

export { ArtsdataReconciliationApp }
