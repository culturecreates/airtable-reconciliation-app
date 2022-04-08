import { initializeBlock, useBase, Loader, Button, Box, Label, useRecords, TablePicker, FieldPicker, Select } from '@airtable/blocks/ui';
import React, { Fragment, useState } from 'react';

function ArtsdataReconciliationApp() {

    const base = useBase();
    const [isUpdateInProgress, setIsUpdateInProgress] = useState(false);

    const [tableName, setTableName] = useState(null);
    const [entityNameField, setEntityNameField] = useState(null);
    const [artsdataIdField, setArtsdataIdField] = useState(null);
    const [table, setTable] = useState(null);
    const [isTableNameEmpty, setIsTableNameEmpty] = useState(true);
    const [entityType, setEntityType] = useState("");

    if (!!tableName && isTableNameEmpty) {
        setIsTableNameEmpty(false);
        setTable(base.getTableByName(tableName.name));
    }
    const records = useRecords(table);

    const entityTypeOptions = [
        { value: "Organization", label: "Organization" }
    ];

    const permissionCheck = (!!tableName && !!entityNameField && !!entityType && !!artsdataIdField) &&
        table.checkPermissionsForUpdateRecord(undefined, { [artsdataIdField.name]: undefined });


    async function onButtonClick() {
        setIsUpdateInProgress(true)
        await reconcileAndExtractArtsdataIds(table, records, entityNameField, artsdataIdField, entityType)
        setIsUpdateInProgress(false);
    }

    return (
        <Box
            position="absolute"
            top="0"
            bottom="0"
            left="0"
            right="0"
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
        >
            {isUpdateInProgress ? (<Loader fillColor='red' />) : (
                <Fragment>
                    <br></br>
                    <div>
                        <Label htmlFor="my-input" >Select the entity type</Label>
                        <Select
                            options={entityTypeOptions}
                            value={entityType}
                            onChange={newValue => setEntityType(newValue)}
                            width="320px"
                        />
                    </div>
                    <br></br>
                    <div>
                        <Label htmlFor="my-input" >Select the entity type</Label>
                        <TablePicker
                            placeholder='Select table'
                            table={tableName}
                            onChange={newTable => setTableName(newTable)}
                            width="250px" />
                    </div>
                    <br></br>
                    <div>
                        <FieldPicker
                            placeholder='Select entity name field'
                            table={table}
                            field={entityNameField}
                            onChange={newField => setEntityNameField(newField)}
                            width="320px"
                        />
                    </div>
                    <br></br>
                    <FieldPicker
                        placeholder='Select artsdata id field'
                        table={table}
                        field={artsdataIdField}

                        onChange={newField => setArtsdataIdField(newField)}
                        width="320px"
                    />
                    <br></br>
                    <Button
                        variant="primary"
                        onClick={onButtonClick}
                        disabled={!permissionCheck.hasPermission}
                        marginBottom={3}
                    >
                        Reconcile with Artsdata
                    </Button>
                    {!permissionCheck.hasPermission && permissionCheck.reasonDisplayString}
                </Fragment>
            )}
        </Box>
    );
}

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

    while (true) {
        const currentNames = entityNames.slice(offset, offset + batchSize);
        const currentRecords = records.slice(offset, offset + batchSize);
        const encodedUrl = _generateQuery(currentNames, entityType);
        try {
            const response = await fetch(encodedUrl, { cors: true, headers: headersRequest, method: "GET" });
            const artsDataResult = await response.json();
            trueMatches = _findTrueMatches(currentRecords, artsDataResult);
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


function _findTrueMatches(currentRecords, artsdataResult) {
    let trueMatches = [];
    let count = 0;
    for (const record of currentRecords) {
        const trueMatch = artsdataResult?.[`q${count}`]?.['result'].filter(m => m.match === true)
        if (trueMatch?.length === 1) {
            trueMatches.push({ recordId: record.id, artsdataId: trueMatch[0].id });
        } else {
            trueMatches.push({ recordId: record.id, artsdataId: "" });
        }
        count++;
    }
    return trueMatches;
}

function _generateQuery(names, type) {
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

initializeBlock(() => <ArtsdataReconciliationApp />);