import { all, call, fork, put, take, takeEvery, select } from 'redux-saga/effects';
import firebase from 'firebase';

import rsf from '../rsf';
import {
	types,
	getWidgetTypesSuccess,
	getWidgetTypesFailure,
	getUseWidgetsSuccess,
	getUseWidgetsFailure,
	addUseWidgetSuccess,
	addUseWidgetFailure,
	deleteUseWidgetSuccess,
	deleteUseWidgetFailure
} from '../actions/widgets';
import { getUser, getUseWidgets, getDashboards, getSelectedDashboardInd } from './selector';


function* getWidgetTypesSaga({ theme }) {
	try {
		const snapshot = yield call(
			rsf.firestore.getCollection,
			firebase.firestore().collection('widget_types').where('theme', '==', theme)
		);

		let widgetTypes = [];

		snapshot.forEach((widgetType) => {
			widgetTypes.push({
				id: widgetType.id,
				...widgetType.data()
			});
		});

		yield put(getWidgetTypesSuccess(widgetTypes));
	} catch (err) {
		yield put(getWidgetTypesFailure(err));
	}
}

function* getUseWidgetsSaga({ dashboardId }) {
	try {
		let useWidgets = [];
		const user = yield select(getUser);
		const _dashboards = yield select(getDashboards); // no use
		const _selectedDashboardInd = yield select(getSelectedDashboardInd); // no use
		const dashboard = _dashboards[_selectedDashboardInd];

		const useWidgetsSnapshot = yield call(
			rsf.firestore.getCollection,
			`users/${user.uid}/dashboards/${dashboardId}/use_widgets`
		);

		let ind;
		useWidgetsSnapshot.forEach((useWidget) => {
			// search layout
			for (ind = 0; ind < dashboard.layout.length; ind++) {
				if (dashboard.layout[ind].i === useWidget.id) {
					break;
				}
			}

			useWidgets.push({
				id: useWidget.id,
				layout: dashboard.layout[ind],
				...useWidget.data()
			});
		});

		yield put(getUseWidgetsSuccess(useWidgets));
	} catch (err) {
		console.log(err);
		yield put(getUseWidgetsFailure(err));
	}
}

function* addUseWidgetSaga({ addedWidgetType }) {
	try {
		const user = yield select(getUser);
		const _dashboards = yield select(getDashboards); // no use
		const _selectedDashboardInd = yield select(getSelectedDashboardInd); // no use
		const dashboard = _dashboards[_selectedDashboardInd];
		const widgetLayout = { ...addedWidgetType.defaultLayout };
		const _useWidgets = yield select(getUseWidgets); // no use
		const useWidgets = [..._useWidgets];

		// add widget
		const preAddedWidget = yield call(
			rsf.firestore.addDocument,
			`users/${user.uid}/dashboards/${dashboardId}/use_widgets`,
			{
				alias: addedWidgetType.alias,
				name: addedWidgetType.name,
				theme: addedWidgetType.theme
			}
		);
		const AddedWidget = yield call(
			rsf.firestore.getDocument,
			preAddedWidget
		);

		widgetLayout.y = dashboard.height;
		widgetLayout.i = AddedWidget.id;

		// set dashboard
		yield call(
			rsf.firestore.setDocument,
			`users/${user.uid}/dashboards/${dashboardId}`,
			{
				layout: [...dashboard.layout, widgetLayout],
				height: dashboard.height + widgetLayout.h
			},
			{ merge: true }
		);

		const addedWidgets = yield call(
			rsf.firestore.getDocument,
			`users/${user.uid}/dashboards/${dashboardId}/use_widgets`
		);

		// add widget into props.useWidgets
		useWidgets.push({
			id: AddedWidget.id,
			layout: widgetLayout,
			...AddedWidget.data()
		})

		yield put(addUseWidgetSuccess(useWidgets));
	} catch (err) {
		console.log(err);
		yield put(addUseWidgetFailure(err));
	}
}

function* deleteUseWidgetSaga({ widget }) {
	try {
		const user = yield select(getUser);
		const _dashboards = yield select(getDashboards); // no use
		const _selectedDashboardInd = yield select(getSelectedDashboardInd); // no use
		const dashboard = _dashboards[_selectedDashboardInd];
		const layout = [...dashboard.layout];
		const _useWidgets = yield select(getUseWidgets); // no use
		const useWidgets = [..._useWidgets];

		// delete widget in use_widgets
		yield call(
			rsf.firestore.deleteDocument,
			`users/${user.uid}/dashboards/${dashboard.id}/use_widgets/${widget.id}`
		)

		// set dashboard height and layout
		useWidgets.sort((a, b) => { return a.layout.y - b.layout.y });
		layout.sort((a, b) => { return a.y - b.y });

		let ind;
		let deletedWidgetInd = -1;
		for (ind = 0; ind < useWidgets.length; ind++) {
			if (deletedWidgetInd !== -1) {
				// after found
				useWidgets[ind].layout.y -= widget.height;
				layout.y -= widget.height;
			}

			if (useWidgets[ind].id === widget.id) {
				// find
				deletedWidgetInd = ind;

				// delete widget on firestore
				yield call(
					rsf.firestore.deleteDocument,
					`users/${user.uid}/dashboards/${dashboard.id}/use_widgets/${useWidgets[ind].id}`
				);
			}
		}

		useWidgets.splice(deletedWidgetInd, 1);
		layout.splice(deletedWidgetInd, 1);

		// set dashboard
		yield call(
			rsf.firestore.setDocument,
			`users/${user.uid}/dashboards/${dashboard.id}`,
			{
				layout,
				height: dashboard.height - widget.layout.h
			},
			{ merge: true }
		);

		yield put(deleteUseWidgetSuccess(useWidgets));
	} catch (err) {
		console.log(err);
		yield put(deleteUseWidgetFailure(err));
	}
}

export default function* widgetsRootSaga() {
	yield all([
		takeEvery(types.GET_WIDGET_TYPES.REQUEST, getWidgetTypesSaga),
		takeEvery(types.GET_USE_WIDGETS.REQUEST, getUseWidgetsSaga),
		takeEvery(types.ADD_USE_WIDGET.REQUEST, addUseWidgetSaga),
		takeEvery(types.DELETE_USE_WIDGET.REQUEST, deleteUseWidgetSaga)
	]);
}
