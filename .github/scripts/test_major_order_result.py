import copy
import json
import unittest
from pathlib import Path
from datetime import timedelta
import update_major_order as rules

FIXTURE = json.loads((Path(__file__).parent / 'fixtures/order-context.json').read_text())

class OrderResultTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = copy.deepcopy(FIXTURE['snapshot'])
        self.dispatch = copy.deepcopy(FIXTURE['dispatch'])
        self.now = rules.parse_date(FIXTURE['now'])

    def outcome(self, dispatches=None):
        return rules.dispatch_outcome(dispatches or [self.dispatch], self.snapshot, self.now)

    def test_real_failed_announcement(self):
        self.assertEqual('failed', self.outcome()['state'])

    def test_explicit_success_with_matching_context(self):
        self.dispatch['message'] = self.dispatch['message'].replace('MAJOR ORDER FAILED', 'MAJOR ORDER WON')
        self.assertEqual('completed', self.outcome()['state'])

    def test_old_announcement_is_rejected(self):
        self.dispatch['published'] = '2026-09-26T11:32:14Z'
        self.assertIsNone(self.outcome())

    def test_unrelated_order_is_rejected(self):
        self.dispatch['message'] = 'MAJOR ORDER FAILED\nThe Helldivers failed to liberate unrelated worlds.'
        self.assertIsNone(self.outcome())

    def test_single_common_topic_is_insufficient(self):
        self.dispatch['message'] = 'MAJOR ORDER FAILED\nThe Maelstrom project was unsuccessful.'
        self.assertIsNone(self.outcome())

    def test_wrong_explicit_id_is_rejected_even_with_same_context(self):
        self.dispatch['assignmentId'] = 999
        self.assertIsNone(self.outcome())

    def test_new_order_announcement_blocks_ambiguous_result(self):
        new = {'published': '2026-10-01T19:31:30Z', 'message': 'NEW MAJOR ORDER\nAnother objective.'}
        self.assertIsNone(self.outcome([self.dispatch, new]))

    def test_context_does_not_link_result_long_before_expiration(self):
        self.dispatch['published'] = '2026-10-01T18:00:00Z'
        self.assertIsNone(self.outcome())

    def test_future_announcement_is_rejected(self):
        self.dispatch['published'] = rules.iso(self.now + timedelta(hours=1))
        self.assertIsNone(self.outcome())

    def test_matching_explicit_id_remains_supported(self):
        self.dispatch.update(assignmentId=self.snapshot['order']['id'], message='MAJOR ORDER FAILED')
        self.assertEqual('failed', self.outcome()['state'])

    def test_expiration_alone_cannot_confirm_failure(self):
        self.assertIsNone(rules.dispatch_outcome([], self.snapshot, self.now))

if __name__ == '__main__':
    unittest.main()
