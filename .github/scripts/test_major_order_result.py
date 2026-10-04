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

class DefenseResultTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads((Path(__file__).parent / 'fixtures/order-defense-result.json').read_text())
        self.snapshot = self.fixture['snapshot']
        self.now = rules.parse_date(self.fixture['now'])
        self.dispatches = [self.fixture['dispatch'], self.fixture['opening']]

    def test_real_early_victory_without_planet_names(self):
        self.assertEqual('completed', rules.dispatch_outcome(self.dispatches, self.snapshot, self.now)['state'])

    def test_opening_required_for_early_result(self):
        self.assertIsNone(rules.dispatch_outcome(self.dispatches[:1], self.snapshot, self.now))

    def test_unrelated_opening(self):
        self.dispatches[1]['message'] = 'NEW MAJOR ORDER\nDefend unrelated planets.'
        self.assertIsNone(rules.dispatch_outcome(self.dispatches, self.snapshot, self.now))

    def test_new_opening_even_with_identical_planets(self):
        self.dispatches.append({**self.fixture['opening'], 'published': '2026-10-04T03:00:00Z'})
        self.assertIsNone(rules.dispatch_outcome(self.dispatches, self.snapshot, self.now))

    def test_wrong_explicit_result_id(self):
        self.dispatches[0]['assignmentId'] = 999
        self.assertIsNone(rules.dispatch_outcome(self.dispatches, self.snapshot, self.now))

    def test_portuguese_results(self):
        for message, expected in [('GRANDE ORDEM CONQUISTADA', 'completed'), ('ORDEM MAIOR CONQUISTADA', 'completed'), ('FALHA NO PEDIDO PRINCIPAL', 'failed')]:
            with self.subTest(message=message):
                self.dispatches[0]['message'] = message
                self.assertEqual(expected, rules.dispatch_outcome(self.dispatches, self.snapshot, self.now)['state'])

class BoundaryTests(unittest.TestCase):
    setUp = DefenseResultTests.setUp
    def test_repeated_targets_cannot_cross_new_order(self):
        for opening_title in ['NEW MAJOR ORDER', 'NOVA ORDEM IMPERATIVA', 'NOVA GRANDE ORDEM']:
            opening = {'published': '2026-10-04T03:00:00Z', 'message': opening_title + '\nGATRIA and WASAT.'}
            for title in ['MAJOR ORDER WON', 'MAJOR ORDER FAILED']:
                with self.subTest(opening=opening_title, title=title):
                    result = {**self.fixture['dispatch'], 'message': title + '\nGATRIA and WASAT.'}
                    self.assertIsNone(rules.dispatch_outcome([self.fixture['opening'], opening, result], self.snapshot, self.now))

    def test_explicit_id_still_links_previous_order(self):
        opening = {'published': '2026-10-04T03:00:00Z', 'message': 'NEW MAJOR ORDER'}
        result = {**self.fixture['dispatch'], 'message': 'MAJOR ORDER FAILED', 'assignmentId': self.snapshot['order']['id']}
        self.assertEqual('failed', rules.dispatch_outcome([opening, result], self.snapshot, self.now)['state'])

    def test_wrong_opening_id_blocks_matching_planets(self):
        opening = {**self.fixture['opening'], 'assignmentId': 999}
        result = {**self.fixture['dispatch'], 'message': 'MAJOR ORDER WON\nGATRIA and WASAT.'}
        self.assertIsNone(rules.dispatch_outcome([opening, result], self.snapshot, self.now))

    def test_result_before_new_opening_remains_valid(self):
        opening = {'published': '2026-10-04T04:40:00Z', 'message': 'NEW MAJOR ORDER'}
        self.assertEqual('completed', rules.dispatch_outcome(self.dispatches + [opening], self.snapshot, self.now)['state'])

    def test_imperative_and_news(self):
        for title, expected in [('ORDEM IMPERATIVA CONCLUÍDA', 'completed'), ('ORDEM IMPERATIVA FRACASSADA', 'failed'), ('NOTÍCIAS DA GUERRA', None)]:
            with self.subTest(title=title):
                result = {**self.fixture['dispatch'], 'message': title}
                outcome = rules.dispatch_outcome([self.fixture['opening'], result], self.snapshot, self.now)
                self.assertEqual(expected, outcome['state'] if outcome else None)

if __name__ == '__main__':
    unittest.main()
