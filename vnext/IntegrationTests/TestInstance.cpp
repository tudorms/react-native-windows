// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

#include "TestInstance.h"

using namespace facebook::react;

using std::make_unique;
using std::map;
using std::move;
using std::shared_ptr;
using std::string;

namespace Microsoft::React::Test {

#pragma region TestViewManager members

TestViewManager::TestViewManager(const char *name) : m_name{name} {}

const char *TestViewManager::GetName() const {
  return m_name.c_str();
}

folly::dynamic TestViewManager::GetExportedViewConstants() const {
  return folly::dynamic();
}

folly::dynamic TestViewManager::GetCommands() const {
  return folly::dynamic();
}

folly::dynamic TestViewManager::GetNativeProps() const {
  // TODO: RCTView generated view config for validAttributes does not match native, missing: dummyprop
  return folly::dynamic::object("dummyprop", "string");
}

ShadowNode *TestViewManager::createShadow() const {
  return new TestShadowNode();
}

void TestViewManager::destroyShadow(ShadowNode *) const {}

folly::dynamic TestViewManager::GetConstants() const {
  folly::dynamic constants = folly::dynamic::object("Constants", GetExportedViewConstants())("Commands", GetCommands())(
      "NativeProps", GetNativeProps());

  const auto bubblingEventTypesConstants = GetExportedCustomBubblingEventTypeConstants();
  if (!bubblingEventTypesConstants.empty())
    constants["bubblingEventTypes"] = bubblingEventTypesConstants;
  const auto directEventTypesConstants = GetExportedCustomDirectEventTypeConstants();
  if (!directEventTypesConstants.empty())
    constants["directEventTypes"] = directEventTypesConstants;

  return constants;
}

folly::dynamic TestViewManager::GetExportedCustomBubblingEventTypeConstants() const {
  return folly::dynamic::object();
}

folly::dynamic TestViewManager::GetExportedCustomDirectEventTypeConstants() const {
  return folly::dynamic::object();
}

#pragma endregion TestViewManager members

#pragma region TestNativeUIManager members

void TestNativeUIManager::configureNextLayoutAnimation(
    folly::dynamic &&config,
    facebook::xplat::module::CxxModule::Callback success,
    facebook::xplat::module::CxxModule::Callback error) {}

void TestNativeUIManager::destroy() {}

ShadowNode *TestNativeUIManager::createRootShadowNode(IReactRootView *rootView) {
  return new TestShadowNode();
}

void TestNativeUIManager::destroyRootShadowNode(ShadowNode *node) {
  delete node;
}

void TestNativeUIManager::removeRootView(ShadowNode &rootNode) {}

void TestNativeUIManager::setHost(INativeUIManagerHost *host) {}

void TestNativeUIManager::onBatchComplete() {}

void TestNativeUIManager::ensureInBatch() {}

void TestNativeUIManager::measure(
    facebook::react::ShadowNode &shadowNode,
    facebook::react::ShadowNode &shadowRoot,
    facebook::xplat::module::CxxModule::Callback callback) {}

void TestNativeUIManager::measureInWindow(
    facebook::react::ShadowNode &shadowNode,
    facebook::xplat::module::CxxModule::Callback callback) {}

void TestNativeUIManager::measureLayout(
    facebook::react::ShadowNode &shadowNode,
    facebook::react::ShadowNode &ancestorShadowNode,
    facebook::xplat::module::CxxModule::Callback callbackFail,
    facebook::xplat::module::CxxModule::Callback callbackSuccess){};

void TestNativeUIManager::findSubviewIn(
    facebook::react::ShadowNode &shadowNode,
    float x,
    float y,
    facebook::xplat::module::CxxModule::Callback callback) {}

void TestNativeUIManager::AddRootView(
    facebook::react::ShadowNode &shadowNode,
    facebook::react::IReactRootView *pReactRootView) {}

void TestNativeUIManager::CreateView(facebook::react::ShadowNode &shadowNode, folly::dynamic /*ReadableMap*/ props) {}

void TestNativeUIManager::AddView(
    facebook::react::ShadowNode &parentShadowNode,
    facebook::react::ShadowNode &childShadowNode,
    uint64_t index) {}

void TestNativeUIManager::RemoveView(facebook::react::ShadowNode &shadowNode, bool removeChildren) {}

void TestNativeUIManager::ReplaceView(facebook::react::ShadowNode &shadowNode) {}

void TestNativeUIManager::UpdateView(facebook::react::ShadowNode &shadowNode, folly::dynamic /*ReadableMap*/ props) {}

void TestNativeUIManager::focus(int64_t reactTag) {}

void TestNativeUIManager::blur(int64_t reactTag) {}

#pragma endregion TestNativeUIManager members

#pragma region TestShadowNode members

void TestShadowNode::onDropViewInstance() {}

void TestShadowNode::removeAllChildren() {}

void TestShadowNode::AddView(ShadowNode &child, int64_t index) {}

void TestShadowNode::RemoveChildAt(int64_t indexToRemove) {}

void TestShadowNode::createView() {}

#pragma endregion

} // namespace Microsoft::React::Test

namespace folly {
char const *const dynamic::TypeInfo<dynamic::ObjectImpl>::name = "object";
}
