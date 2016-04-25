/*
 * Copyright 2015-present Boundless Spatial Inc., http://boundlessgeo.com
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations under the License.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import ol from 'openlayers';
import Dialog from 'material-ui/lib/dialog';
import Snackbar from 'material-ui/lib/snackbar';
import AppDispatcher from '../dispatchers/AppDispatcher.js';
import LoginConstants from '../constants/LoginConstants.js';
import FeatureStore from '../stores/FeatureStore.js';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import pureRender from 'pure-render-decorator';
import TextField from 'material-ui/lib/text-field';
import RaisedButton from 'material-ui/lib/raised-button';
import GridList from 'material-ui/lib/grid-list/grid-list';
import GridTile from 'material-ui/lib/grid-list/grid-tile';
import List from 'material-ui/lib/lists/list';
import ListItem from 'material-ui/lib/lists/list-item';
import FolderIcon from 'material-ui/lib/svg-icons/file/folder-open';
import LayerIcon from 'material-ui/lib/svg-icons/maps/layers';
import URL from 'url-parse';
import WMSService from '../services/WMSService.js';
import WFSService from '../services/WFSService.js';
import RESTService from '../services/RESTService.js';

const messages = defineMessages({
  title: {
    id: 'addwmslayermodal.title',
    description: 'Title for the modal Add layer dialog',
    defaultMessage: 'Add Layer'
  },
  errormsg: {
    id: 'addwmslayermodal.errormsg',
    description: 'Error message to show the user when a GetCapabilities request fails',
    defaultMessage: 'Error retrieving GetCapabilities. {msg}'
  },
  inputfieldlabel: {
    id: 'addwmslayermodal.inputfieldlabel',
    description: 'Label for input field',
    defaultMessage: '{serviceType} Endpoint'
  },
  connectbutton: {
    id: 'addwmslayermodal.connectbutton',
    description: 'Text for connect button',
    defaultMessage: 'Connect'
  },
  closebutton: {
    id: 'addwmslayermodal.closebutton',
    description: 'Text for close button',
    defaultMessage: 'Close'
  }
});

const geojsonFormat = new ol.format.GeoJSON();

/**
 * Modal window to add layers from a WMS or WFS service.
 */
@pureRender
class AddLayerModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: false,
      errorOpen: false,
      open: false,
      layers: []
    };
    var me = this;
    AppDispatcher.register((payload) => {
      let action = payload.action;
      switch (action.type) {
        case LoginConstants.LOGIN:
          me._updateLayers();
          break;
        case LoginConstants.LOGOUT:
          me._updateLayers();
          break;
        default:
          break;
      }
    });
  }
  componentDidMount() {
    this._getCaps(this._getCapabilitiesUrl(this.props.url));
  }
  componentWillUnmount() {
    if (this._request) {
      this._request.abort();
    }
  }
  _getCaps(url) {
    var me = this;
    var failureCb = function(xmlhttp) {
      delete me._request;
      me._setError(xmlhttp.status + ' ' + xmlhttp.statusText);
    };
    var successCb = function(layerInfo) {
      delete me._request;
      me.setState({layerInfo: layerInfo});
    };
    if (this.props.asVector) {
      me._request = WFSService.getCapabilities(url, successCb, failureCb);
    } else {
      me._request = WMSService.getCapabilities(url, successCb, failureCb);
    }
  }
  _updateLayers() {
    var me = this;
    // this needs a timeout for the cookie to be set apparently
    window.setTimeout(function() {
      me._getCaps(me._getCapabilitiesUrl(me.props.url));
    }, 500);
  }
  _setError(msg) {
    this.setState({
      errorOpen: true,
      error: true,
      msg: msg
    });
  }
  _getStyleName(olLayer) {
    var url = this.props.url;
    RESTService.getStyleName(url, olLayer, function(styleName) {
      olLayer.set('styleName', styleName);
    }, function() {
      olLayer.set('canStyle', false);
    });
  }
  _getWfsInfo(layer, olLayer) {
    var me = this;
    // do a WFS DescribeFeatureType request to get wfsInfo
    WFSService.describeFeatureType(me.props.url, layer, function(wfsInfo) {
      olLayer.set('wfsInfo', wfsInfo);
      if (olLayer instanceof ol.layer.Tile) {
        FeatureStore.loadFeatures(olLayer, 0);
      }
    }, function() {});
    // TODO handle failure
  }
  _onLayerClick(layer) {
    var map = this.props.map;
    var view = map.getView();
    var EX_GeographicBoundingBox = layer.EX_GeographicBoundingBox;
    if (view.getProjection().getCode() === 'EPSG:3857') {
      EX_GeographicBoundingBox[0] = Math.max(-180, EX_GeographicBoundingBox[0]);
      EX_GeographicBoundingBox[1] = Math.max(-85, EX_GeographicBoundingBox[1]);
      EX_GeographicBoundingBox[2] = Math.min(180, EX_GeographicBoundingBox[2]);
      EX_GeographicBoundingBox[3] = Math.min(85, EX_GeographicBoundingBox[3]);
    }
    var extent = ol.proj.transformExtent(layer.EX_GeographicBoundingBox, 'EPSG:4326', view.getProjection());
    var olLayer;
    if (this.props.asVector) {
      var me = this;
      olLayer = new ol.layer.Vector({
        title: layer.Title,
        id: layer.Name,
        isWFST: true,
        canStyle: true,
        isRemovable: true,
        isSelectable: true,
        popupInfo: '#AllAttributes',
        source: new ol.source.Vector({
          url: function(extent) {
            return me.props.url.replace('wms', 'wfs') + 'service=WFS' +
              '&version=1.1.0&request=GetFeature&typename=' + layer.Name +
              '&outputFormat=application/json&srsname=EPSG:3857' +
              '&bbox=' + extent.join(',') + ',EPSG:3857';
          },
          format: geojsonFormat,
          strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
            maxZoom: 19
          }))
        })
      });
    } else {
      olLayer = new ol.layer.Tile({
        title: layer.Title,
        id: layer.Name,
        isRemovable: true,
        isSelectable: true,
        isWFST: true,
        EX_GeographicBoundingBox: extent,
        canStyle: true,
        wfsInfo: true,
        popupInfo: '#AllAttributes',
        source: new ol.source.TileWMS({
          url: this.props.url,
          wrapX: false,
          params: {
            LAYERS: layer.Name
          },
          serverType: 'geoserver'
        })
      });
      this._getStyleName.call(this, olLayer);
    }
    this._getWfsInfo.call(this, layer, olLayer);
    map.addLayer(olLayer);
    if (!this.props.asVector) {
      view.fit(extent, map.getSize());
    }
    this.close();
  }
  _getCapabilitiesUrl(url) {
    var urlObj = new URL(url);
    if (this.props.asVector) {
      urlObj.set('query', {
        service: 'WFS',
        version: '1.1.0',
        request: 'GetCapabilities'
      });
    } else {
      urlObj.set('query', {
        service: 'WMS',
        request: 'GetCapabilities',
        version: '1.3.0'
      });
    }
    return urlObj.toString();
  }
  _connect() {
    var url = this.refs.url.getValue();
    this._getCaps(this._getCapabilitiesUrl(url));
  }
  _getLayersMarkup(layer) {
    var childList;
    if (layer.Layer) {
      var children = layer.Layer.map(function(child) {
        return this._getLayersMarkup(child);
      }, this);
      childList = children;
    }
    var onTouchTap;
    if (layer.Name) {
      onTouchTap = this._onLayerClick.bind(this, layer);
    }
    var leftIcon;
    if (layer.Layer) {
      leftIcon = <FolderIcon />;
    } else if (layer.Name) {
      leftIcon = <LayerIcon />;
    }
    return (
      <ListItem onTouchTap={onTouchTap} leftIcon={leftIcon} initiallyOpen={true} key={layer.Name || layer.Title} primaryText={layer.Title} nestedItems={childList} />
    );
  }
  open() {
    this.setState({open: true});
  }
  close() {
    this.setState({open: false});
  }
  _handleRequestClose() {
    this.setState({
      errorOpen: false
    });
  }
  render() {
    const {formatMessage} = this.props.intl;
    var layers;
    if (this.state.layerInfo) {
      var layerInfo = this._getLayersMarkup(this.state.layerInfo);
      layers = <List>{layerInfo}</List>;
    }
    var error;
    if (this.state.error === true) {
      error = (<Snackbar
        open={this.state.errorOpen}
        message={formatMessage(messages.errormsg, {msg: this.state.msg})}
        autoHideDuration={2000}
        onRequestClose={this._handleRequestClose.bind(this)}
      />);
    }
    var input;
    if (this.props.allowUserInput) {
      var serviceType = this.props.asVector ? 'WFS' : 'WMS';
      input = (
        <GridList cellHeight={75}>
          <GridTile><TextField floatingLabelText={formatMessage(messages.inputfieldlabel, {serviceType: serviceType})} defaultValue={this.props.url} ref='url' /></GridTile>
          <GridTile><RaisedButton label={formatMessage(messages.connectbutton)} onTouchTap={this._connect.bind(this)} /></GridTile>
        </GridList>
      );
    }
    var actions = [
      <RaisedButton label={formatMessage(messages.closebutton)} onTouchTap={this.close.bind(this)} />
    ];
    return (
      <Dialog actions={actions} autoScrollBodyContent={true} modal={true} title={formatMessage(messages.title)} open={this.state.open} onRequestClose={this.close.bind(this)}>
        {input}
        {layers}
        {error}
      </Dialog>
    );
  }
}

AddLayerModal.propTypes = {
  /**
   * The ol3 map to upload to.
   */
  map: React.PropTypes.instanceOf(ol.Map).isRequired,
  /**
   * url that will be used to retrieve layers from (WMS or WFS).
   */
  url: React.PropTypes.string.isRequired,
  /**
   * Should we add layers as vector? Will use WFS GetCapabilities.
   */
  asVector: React.PropTypes.bool,
  /**
   * Should be user be able to provide their own url?
   */
  allowUserInput: React.PropTypes.bool,
  /**
   * The srs name that the map's view is in.
   */
  srsName: React.PropTypes.string,
  /**
   * i18n message strings. Provided through the application through context.
   */
  intl: intlShape.isRequired
};

AddLayerModal.defaultProps = {
  asVector: false,
  allowUserInput: false
};

export default injectIntl(AddLayerModal, {withRef: true});
