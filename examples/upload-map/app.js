/* global saveAs */
/** Demo adding a map through mapbox style and exporting the map's endpoints to a file.
 *
 */

import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunkMiddleware from 'redux-thunk';

import React from 'react';
import ReactDOM from 'react-dom';

import SdkMap from '@boundlessgeo/sdk/components/map';
import SdkMapReducer from '@boundlessgeo/sdk/reducers/map';
import * as mapActions from '@boundlessgeo/sdk/actions/map';

// This will have webpack include all of the SDK styles.
import '@boundlessgeo/sdk/stylesheet/sdk.scss';

import ContextSelector from './context-selector';

/* eslint-disable no-underscore-dangle */
const store = createStore(combineReducers({
  map: SdkMapReducer,
}), window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__(),
   applyMiddleware(thunkMiddleware));

function main() {
  // add a background layer
  store.dispatch(mapActions.addLayer({
    id: 'background',
    type: 'background',
    paint: {
      'background-color': '#eee',
    },
  }));

  const exportMapSpec = () => {
    const map_spec = store.getState().map;
    const text = JSON.stringify(map_spec);
    const file = new File([text], 'my_map', {type: "application/json"});
    saveAs(file, 'my_map.json');
  };

  // place the map on the page.
  ReactDOM.render(
    <SdkMap
      store={store}
    />
  , document.getElementById('map'));

  // add a button to demo the action.
  ReactDOM.render((
    <div>
      <ContextSelector store={store} />
      <h1>Save a Map</h1>
      <h2>To .json:</h2>
      <button className="sdk-btn" onClick={exportMapSpec}>Save Map</button>
    </div>
  ), document.getElementById('controls'));
}

main();
