import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import PersonFinderResults from './PersonFinderResults';
import InputBox from '../../react-chayns-input_box/component/InputBox';
import WaitCursor from './WaitCursor';
import getListLength from '../utils/getListLength';
import getSelectedListItem from '../utils/getSelectedListItem';

const LAZY_LOADING_SPACE = 100;

class PersonFinderView extends Component {
    constructor(props) {
        super(props);
        this.state = {
            lazyLoading: false,
            focusIndex: props.autoSelectFirst ? 0 : null,
        };
    }

    updateIndex = (index) => {
        const { data, value, orm } = this.props;
        let focusIndex = index;
        if (focusIndex !== null) {
            const listLength = getListLength(data, orm, value);
            if (focusIndex >= listLength) {
                focusIndex = listLength - 1;
            }
            if (focusIndex < 0) {
                focusIndex = 0;
            }
            if (this.animationFrameId) {
                window.cancelAnimationFrame(this.animationFrameId);
            }
            this.animationFrameId = window.requestAnimationFrame(() => {
                if (this.resultList) {
                    this.resultList.scrollTo(0, (63 * (focusIndex - 1)));
                }
                this.animationFrameId = null;
            });
        }
        this.setState({ focusIndex });
    };

    handleOnBlur = () => {
        const { autoSelectFirst } = this.props;
        this.updateIndex(autoSelectFirst ? 0 : null);
    };

    handleKeyDown = (ev) => {
        const { focusIndex } = this.state;
        const {
            onSelect,
            data,
            orm,
            value,
            onKeyDown,
            autoSelectFirst,
        } = this.props;

        if (onKeyDown) {
            onKeyDown(ev);
        }

        if (!this.resultList) return;

        switch (ev.keyCode) {
            case 40: // Arrow down
                ev.preventDefault();
                if (focusIndex === null) {
                    this.updateIndex(0);
                } else {
                    this.updateIndex(focusIndex + 1);
                }
                break;
            case 38: // Arrow up
                ev.preventDefault();
                if (focusIndex === null) {
                    this.updateIndex(0);
                } else {
                    this.updateIndex(focusIndex - 1);
                }
                break;
            case 27: // Esc
                this.updateIndex(autoSelectFirst ? 0 : null);
                this.boxRef.blur();
                break;
            case 13: // Enter
                if (focusIndex !== null) {
                    const item = getSelectedListItem(data, focusIndex, orm, value);
                    if (item !== undefined) {
                        onSelect(undefined, item);
                    }
                    this.updateIndex(autoSelectFirst ? 0 : null);
                    if (this.resultList) {
                        this.resultList.scrollTo(0, 0);
                    }
                }
                break;
            default:
                break;
        }
    };

    handleLazyLoad = async () => {
        if (!this.resultList) return;

        const { lazyLoading } = this.state;

        const { value, autoLoading, onLoadMore } = this.props;
        const { scrollTop, offsetHeight, scrollHeight } = this.resultList;

        if (onLoadMore && autoLoading && !lazyLoading && (scrollHeight - scrollTop - offsetHeight) <= LAZY_LOADING_SPACE) {
            this.setState({
                lazyLoading: true,
            });
            await onLoadMore('default', value);
            this.setState({
                lazyLoading: false,
            });
        }
    };

    hasEntries = () => {
        const { data, orm, value } = this.props;
        return Array.isArray(orm.groups)
            ? orm.groups.some(({ key: group, show }) => (typeof show !== 'function' || show(value))
                && Array.isArray(data[group]) && data[group].length)
            : !!((Array.isArray(data) && data.length) || Object.values(data)
                .some((d) => Array.isArray(d) && d.length));
    };

    renderChildren() {
        const {
            onSelect,
            selectedValue,
            data,
            orm,
            value,
            hasMore,
            onLoadMore,
            showWaitCursor: waitCursor,
        } = this.props;

        const { focusIndex } = this.state;

        const hasEntries = this.hasEntries();

        if (!selectedValue && hasEntries) {
            return (
                <PersonFinderResults
                    key="results"
                    onSelect={onSelect}
                    data={data}
                    orm={orm}
                    value={value}
                    onLoadMore={async (type) => {
                        if (!onLoadMore) return;
                        await onLoadMore(type, value);
                    }}
                    showWaitCursor={waitCursor}
                    hasMore={hasMore}
                    focusIndex={focusIndex}
                />
            );
        }

        if (waitCursor === true || Object.values(waitCursor)
            .some((x) => x)) {
            return (
                <WaitCursor key="wait-cursor"/>
            );
        }

        return null;
    }

    render() {
        const {
            onSelect,
            selectedValue,
            value,
            inputComponent,
            boxClassName,
            parent,
            orm,
            boxRef,
            onChange,
            onKeyDown,
            autoSelectFirst,
            ...props
        } = this.props;

        return (
            <InputBox
                onBlur={this.handleOnBlur}
                parent={parent}
                key="single"
                ref={(ref) => {
                    if (boxRef) {
                        boxRef(ref);
                    }
                    this.boxRef = ref;
                }}
                inputComponent={inputComponent}
                onKeyDown={this.handleKeyDown}
                onAddTag={(data) => {
                    if (data.text !== undefined) {
                        return onSelect(undefined, {
                            [orm.identifier]: data.text,
                            [orm.showName]: data.text,
                        });
                    }
                    return null;
                }}
                value={value}
                boxClassName={classNames('cc__person-finder__overlay', boxClassName)}
                overlayProps={{
                    ref: (ref) => {
                        this.resultList = ref;
                    },
                    onScroll: this.handleLazyLoad,
                }}
                onChange={(...e) => {
                    onChange(...e);
                    this.updateIndex(autoSelectFirst ? 0 : null);
                }}
                {...props}
            >
                {this.renderChildren()}
            </InputBox>
        );
    }
}

PersonFinderView.propTypes = {
    orm: PropTypes.shape({
        identifier: PropTypes.string,
        showName: PropTypes.string,
        search: PropTypes.arrayOf(PropTypes.string),
        imageUrl: PropTypes.string,
        groups: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string.isRequired,
            show: PropTypes.func,
        })),
    }).isRequired,
    data: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.object),
        PropTypes.objectOf(PropTypes.arrayOf(PropTypes.object)),
    ]),
    autoLoading: PropTypes.bool,
    hasMore: PropTypes.oneOfType([
        PropTypes.objectOf(PropTypes.bool),
        PropTypes.bool,
    ]),
    onSelect: PropTypes.func.isRequired,
    onLoadMore: PropTypes.func,
    value: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.string,
    ]),
    selectedValue: PropTypes.bool,
    inputComponent: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.node,
    ]).isRequired,
    boxClassName: PropTypes.string,
    parent: typeof Element !== 'undefined' ? PropTypes.instanceOf(Element) : () => {},
    boxRef: PropTypes.func,
    showWaitCursor: PropTypes.oneOfType([
        PropTypes.objectOf(PropTypes.bool),
        PropTypes.bool,
    ]),
    onChange: PropTypes.func,
    autoSelectFirst: PropTypes.bool,
    onKeyDown: PropTypes.func,
};

PersonFinderView.defaultProps = {
    value: '',
    data: [],
    autoLoading: false,
    hasMore: false,
    onLoadMore: null,
    selectedValue: false,
    boxClassName: null,
    parent: document.querySelector('.tapp'),
    boxRef: null,
    showWaitCursor: false,
    onChange: null,
    autoSelectFirst: false,
    onKeyDown: null,
};

PersonFinderView.displayName = 'PersonFinderView';

export default PersonFinderView;
