/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 */

import {
  Switch,
  TextInput,
  View,
  StyleSheet,
  Button,
} from 'react-native';
import {DatePicker} from '../../../../Libraries/Components/DatePicker/DatePicker';
import {Picker} from '../../../../Libraries/Components/Picker/PickerWindows';
import * as React from 'react'
import { useState } from 'react';
import { SHOWBORDER_ON_CONTROLSTYLE, TREE_DUMP_RESULT } from './Consts';
import { TreeDumpControl } from './TreeDumpControl';

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  regularBorder: {
    height: 50,
    backgroundColor: 'rgba(225,225,225,0.2)',
    borderWidth: 1,
    borderColor: '#ff00ff55',
    marginBottom: 10,
    padding: 10,
    color: '#fff',
  },
  roundBorder: {
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: 10,
    padding: 10,
    color: '#000',
    borderRadius: 10.0,
    borderWidth: 10,
    borderColor: '#00ff0055',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    borderRadius: 10.0,
  },
  treeDumpControl: {
    height: 150,
    width: 500,
    margin: 10,
  },
});

export function ControlStyleTestPage() {
  const [showRoundBorder, setShowRoundBorder] = useState(false);

  const onPressShowRoundBorder = () => {
    var previousState = showRoundBorder;
    setShowRoundBorder(!previousState);
  };

  return (
    <View>
      <View testID={'ControlStyleView'}>
        {
          <Switch
            style={showRoundBorder ? styles.roundBorder : styles.regularBorder}
            thumbColor="blue"
          />
        }
        <TextInput
          style={showRoundBorder ? styles.roundBorder : styles.regularBorder}
          placeholder="TextBox"
          placeholderTextColor="rgba(225,225,225,0.7)"
          editable={false}
        />

        <TextInput
          style={showRoundBorder ? styles.roundBorder : styles.regularBorder}
          placeholder="Password"
          placeholderTextColor="rgba(225,225,225,0.7)"
          secureTextEntry={true}
          editable={false}
        />
        <DatePicker
          style={showRoundBorder ? styles.roundBorder : styles.regularBorder}
        />
        <Picker
          style={showRoundBorder ? styles.roundBorder : styles.regularBorder}
        />
      </View>

      <Button
        title={showRoundBorder ? 'Hide Round Border' : 'Show Round Border'}
        onPress={onPressShowRoundBorder}
        testID={SHOWBORDER_ON_CONTROLSTYLE}
      />

      <TreeDumpControl
        style={styles.treeDumpControl}
        dumpID={
          showRoundBorder
            ? 'ControlStyleRoundBorder'
            : 'ControlStyleRegularBorder'
        }
        uiaID={'ControlStyleView'}
        testID={TREE_DUMP_RESULT}
      />
    </View>
  );
}

export const displayName = (_undefined?: string) => {};
export const title = '<LegacyControlStyleTest>';
export const description = 'Legacy e2e test for Control Styles';
export const examples = [
  {
    render: function(): JSX.Element {
      return <ControlStyleTestPage />;
    },
  },
];