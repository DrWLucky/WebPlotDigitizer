/*
    WebPlotDigitizer - https://automeris.io/WebPlotDigitizer

    Copyright 2010-2020 Ankit Rohatgi <ankitrohatgi@hotmail.com>

    This file is part of WebPlotDigitizer.

    WebPlotDIgitizer is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    WebPlotDigitizer is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with WebPlotDigitizer.  If not, see <http://www.gnu.org/licenses/>.
*/

var wpd = wpd || {};

wpd.FileManager = class {
    constructor() {
        this.$pageInfoElements = document.getElementsByClassName('paged');
        this.$fileSelectorContainers = document.getElementsByClassName('files');
        this.$fileSelector = document.getElementById('image-file-select');
        this._init();
    }

    _init() {
        this.currentIndex = 0;
        this.pageManagers = {};
        this.undoManagers = {};
        this.axesByFile = {};
        this.datasetsByFile = {};
        this.measurementsByFile = {};
        this.files = [];
        this._hidePageInfo();
    }

    set(files) {
        this.files = files;
        this._initializeInput();
        if (files.length > 1) {
            this._showFileInfo();
        } else {
            this._hideFileInfo();
        }
    }

    reset() {
        this._init();
    }

    getFiles() {
        return this.files;
    }

    fileCount() {
        return this.files.length;
    }

    currentFileIndex() {
        return this.currentIndex;
    }

    _initializeInput() {
        let optionsHTML = '';
        for (let i = 0; i < this.files.length; i++) {
            optionsHTML += '<option value="' + i;
            if (i === this.currentIndex) optionsHTML += ' selected';
            optionsHTML += '">' + this.files[i].name + '</option>';
        }
        this.$fileSelector.innerHTML = optionsHTML;
    }

    _showFileInfo() {
        wpd.utils.toggleElementsDisplay(this.$fileSelectorContainers, false);
    }

    _hideFileInfo() {
        wpd.utils.toggleElementsDisplay(this.$fileSelectorContainers, true);
    }

    _showPageInfo() {
        wpd.utils.toggleElementsDisplay(this.$pageInfoElements, false);
    }

    _hidePageInfo() {
        wpd.utils.toggleElementsDisplay(this.$pageInfoElements, true);
    }

    // controlling the display logic for page related elements here so it can
    // be managed after file change
    refreshPageInfo() {
        if (wpd.appData.isMultipage()) {
            this._showPageInfo();
        } else {
            this._hidePageInfo();
        }
    }

    _savePageManager() {
        const pageManager = wpd.appData.getPageManager();
        if (pageManager && !this.pageManagers[this.currentIndex]) {
            this.pageManagers[this.currentIndex] = pageManager;
        }
    }

    _loadPageManager(index) {
        let pageManager = null;
        if (this.pageManagers[index]) {
            pageManager = this.pageManagers[index];
        }
        wpd.appData.setPageManager(pageManager);
    }

    _saveUndoManager() {
        let undoManager = null;

        // checks for empty undo managers; if so don't save them to avoid unnecessary
        // use of memory
        if (this.pageManagers[this.currentIndex]) {
            undoManager = wpd.appData.getMultipageUndoManager();
        } else {
            undoManager = wpd.appData.getUndoManager();
            // if cannot undo and cannot redo, we assume it's empty
            if (!undoManager.canUndo() && !undoManager.canRedo()) {
                undoManager = null;
            }
        }

        if (undoManager) {
            this.undoManagers[this.currentIndex] = undoManager;
        }
    }

    _loadUndoManager(index) {
        let undoManager = null;
        if (this.undoManagers[index]) {
            undoManager = this.undoManagers[index];
        }
        wpd.appData.setUndoManager(undoManager);
    }

    switch(index) {
        const newIndex = parseInt(index, 10);
        if (newIndex !== this.currentIndex && newIndex > -1 && newIndex <= this.files.length) {
            // save page manager
            this._savePageManager();

            // load or clear page manager
            this._loadPageManager(newIndex);

            // save undo manager
            this._saveUndoManager();

            // load or clear undo manager
            this._loadUndoManager(newIndex);

            // load the file
            wpd.imageManager.loadFromFile(this.files[newIndex], true);

            // update current file index
            this.currentIndex = newIndex;

            // refresh the tree
            wpd.tree.refresh();
        }
    }

    addAxesToCurrentFile(axes) {
        wpd.utils.addToCollection(this.axesByFile, this.currentIndex, axes);
    }

    addDatasetsToCurrentFile(datasets) {
        wpd.utils.addToCollection(this.datasetsByFile, this.currentIndex, datasets);
    }

    addMeasurementsToCurrentFile(measurements) {
        wpd.utils.addToCollection(this.measurementsByFile, this.currentIndex, measurements);
    }

    deleteDatasetsFromCurrentFile(datasets) {
        wpd.utils.deleteFromCollection(this.datasetsByFile, this.currentIndex, datasets);
    }

    deleteMeasurementsFromCurrentFile(measurements) {
        wpd.utils.deleteFromCollection(this.measurementsByFile, this.currentIndex, measurements);
    }

    getAxesNameMap() {
        return wpd.utils.invertObject(this.axesByFile);
    }

    getDatasetNameMap() {
        return wpd.utils.invertObject(this.datasetsByFile);
    }

    filterToCurrentFileAxes(axes) {
        return wpd.utils.filterCollection(this.axesByFile, this.currentIndex, axes);
    }

    filterToCurrentFileDatasets(datasets) {
        return wpd.utils.filterCollection(this.datasetsByFile, this.currentIndex, datasets);
    }

    filterToCurrentFileMeasurements(measurements) {
        return wpd.utils.filterCollection(this.measurementsByFile, this.currentIndex, measurements);
    }

    // for use with saving wpd json
    getMetadata() {
        const metadata = {};

        const allMeasurements = wpd.appData.getPlotData().getMeasurementColl();

        // save the latest page manager, in case it hasn't been saved
        this._savePageManager();

        // only include file metadata if there is more than 1 file
        if (this.fileCount() > 1) {
            metadata.file = {
                axes: this.getAxesNameMap(),
                datasets: this.getDatasetNameMap(),
                measurements: allMeasurements.map(ms => wpd.utils.findKey(this.measurementsByFile, ms))
            };
        }

        // only include page metadata if there are page managers saved in the file manager
        if (Object.keys(this.pageManagers).length > 0) {
            // setting axes name maps and dataset name maps to start with an empty object
            // for ease of calling Object.assign later
            let axesNameMaps = [{}];
            let datasetNameMaps = [{}];
            let measurementPageMaps = []; // measurements do not have unique names

            // collect metadata from all page managers
            for (const index in this.pageManagers) {
                axesNameMaps.push(this.pageManagers[index].getAxesNameMap());
                datasetNameMaps.push(this.pageManagers[index].getDatasetNameMap());
                measurementPageMaps.push(this.pageManagers[index].getMeasurementPageMap());
            }

            metadata.page = {
                axes: Object.assign.apply(null, axesNameMaps),
                datasets: Object.assign.apply(null, datasetNameMaps),
                measurements: allMeasurements.map(ms => {
                    for (const measurementPageMap of measurementPageMaps) {
                        const foundPage = wpd.utils.findKey(measurementPageMap, ms);
                        if (foundPage) {
                            return foundPage;
                        }
                    }
                })
            };
        }

        return metadata;
    }

    // for use when loading wpd json
    loadMetadata(metadata) {
        let fileManager = this;
        // load file metadata
        if (metadata.file && fileManager.files.length > 1) {
            fileManager.axesByFile = metadata.file.axes;
            fileManager.datasetsByFile = metadata.file.datasets;
            fileManager.measurementsByFile = metadata.file.measurements;
        } else {
            // if the file key doesn't exist or there aren't multiple files, associate all of
            // the file metadata with the only file
            fileManager.axesByFile['0'] = wpd.appData.getPlotData().getAxesColl();
            fileManager.datasetsByFile['0'] = wpd.appData.getPlotData().getDatasets();
            fileManager.measurementsByFile['0'] = wpd.appData.getPlotData().getMeasurementColl();
        }

        // load page metadata
        if (metadata.page) {
            if (fileManager.files.length > 1) {
                let pdfs = [];
                for (let index = 0; index < fileManager.files.length; index++) {
                    if (fileManager.files[index].type === 'application/pdf') {
                        let filePromise = null
                        // skip the first pdf, it has already been loaded
                        if (index > 0) {
                            filePromise = new Promise((resolve, reject) => {
                                let reader = new FileReader();
                                reader.onload = function() {
                                    pdfjsLib.getDocument(reader.result).promise.then(pdf => resolve(pdf));
                                };
                                reader.readAsDataURL(this.files[index]);
                            });
                        }
                        pdfs.push(filePromise);
                    }
                }
                Promise.all(pdfs).then(pdfs => {
                    let pdfIndex = 0;
                    for (let index = 0; index < fileManager.files.length; index++) {
                        if (fileManager.files[index].type === 'application/pdf') {
                            if (pdfs[pdfIndex] !== null) {
                                fileManager.pageManagers[index] = wpd.imageManager.initializePDFManager(
                                    pdfs[pdfIndex]
                                );
                            } else {
                                fileManager._savePageManager();
                            }
                            pdfIndex++;

                            let pageAxes = {};
                            let pageDatasets = {};
                            let pageMeasurements = {};

                            for (const page in metadata.page.axes) {
                                pageAxes[page] = metadata.page.axes[page].filter(ax => {
                                    return fileManager.axesByFile[index]
                                        && fileManager.axesByFile[index].indexOf(ax) > -1;
                                });
                            }
                            for (const page in metadata.page.datasets) {
                                pageDatasets[page] = metadata.page.datasets[page].filter(ds => {
                                    return fileManager.datasetsByFile[index]
                                        && fileManager.datasetsByFile[index].indexOf(ds) > -1;
                                });
                            }
                            for (const page in metadata.page.measurements) {
                                pageMeasurements[page] = metadata.page.measurements[page].filter(ms => {
                                    return fileManager.measurementsByFile[index]
                                        && fileManager.measurementsByFile[index].indexOf(ms) > -1;
                                });
                            }

                            fileManager.pageManagers[index].loadPageData({
                                axes: pageAxes,
                                datasets: pageDatasets,
                                measurements: pageMeasurements
                            });
                        }
                    }
                    wpd.tree.refresh();
                });
            } else {
                // if there aren't multiple files, associate all of the page metadata with
                // the page manager of the only file
                fileManager.pageManagers['0'].loadPageData(metadata.page);
            }
        }
    }
};